import { Api, CDID } from '@concrnt/client'
import { semantics } from './semantics'
import { prepareRepositoryDump } from './migration'

export interface V1ConversionResult {
    lines: string[] // v2 none-proof NDJSON行(バックアップの時系列順を保持)。prepareRepositoryDumpにそのまま渡せる
    oldCcid: string // バックアップから検出した旧CCID
    total: number // バックアップの総行数
    convertedMessages: number
    convertedProfiles: number
    deleted: number // v1のdelete commitにより取り込み対象から除外した件数
    skippedByType: Record<string, number> // 変換対象外の種別ごとの件数(association, timeline, ...)
    skippedOtherSigner: number // 他人が署名者の行(自分の投稿への他人からのfav等)
    externalReferences: number // 他人宛のreply/reroute参照(旧CCIDのまま出力した件数)
    invalidLines: string[] // パース不能・owner不一致の行
}

// v1バックアップの1行は "<documentID> <owner> <signature> <document JSON>" の空白区切り。
// document JSONは空白を含みうるため、4トークン目以降を空白でjoinして復元する(v1のRestore実装と同じ)。
const parseV1Line = (line: string): { documentID: string; owner: string; document: string } | null => {
    const sp = line.split(' ')
    if (sp.length < 4) return null
    const [documentID, owner] = sp
    if (documentID.length !== 26) return null
    if (!owner.startsWith('con1') || owner.length !== 42) return null
    return { documentID, owner, document: sp.slice(3).join(' ') }
}

// v1バックアップをv2のnone proofコミット行へ変換する。鍵を紛失した人向けの取り込みなので、
// 旧CCIDの出現箇所(author/key/distributes/自分宛のreply参照)はすべて新CCIDへ書き換え、
// 現在のアカウントの新規コンテンツとして取り込める形にする(documentIDは新規になる)。
// 変換対象はmessage(reply/reroute含む)とmainプロフィールのみ。それ以外は種別ごとに件数報告する。
export const convertV1Backup = (backupText: string, newCcid: string): V1ConversionResult => {
    const rawLines = backupText.split('\n').filter((line) => line.trim() !== '')

    const result: V1ConversionResult = {
        lines: [],
        oldCcid: '',
        total: rawLines.length,
        convertedMessages: 0,
        convertedProfiles: 0,
        deleted: 0,
        skippedByType: {},
        skippedOtherSigner: 0,
        externalReferences: 0,
        invalidLines: []
    }

    interface ParsedLine {
        raw: string
        documentID: string
        document: string
        doc: any
    }

    // 1周目: パースと妥当性検査、delete対象の収集
    const parsed: ParsedLine[] = []
    const deleteTargets = new Set<string>()
    for (const raw of rawLines) {
        const v1line = parseV1Line(raw)
        if (!v1line) {
            result.invalidLines.push(raw)
            continue
        }
        // dumpはowner固定なので全行一致するはず。異なる行は壊れたファイルとして弾く
        if (result.oldCcid === '') {
            result.oldCcid = v1line.owner
        } else if (v1line.owner !== result.oldCcid) {
            result.invalidLines.push(raw)
            continue
        }
        let doc: any
        try {
            doc = JSON.parse(v1line.document)
        } catch (_e) {
            result.invalidLines.push(raw)
            continue
        }
        if (doc.type === 'delete' && doc.signer === result.oldCcid && typeof doc.target === 'string') {
            deleteTargets.add(doc.target)
        }
        parsed.push({ raw, documentID: v1line.documentID, document: v1line.document, doc })
    }

    const oldCcid = result.oldCcid
    const homeTimelineV1 = `world.concrnt.t-home@${oldCcid}`

    const pushLine = (v2doc: object) => {
        result.lines.push(JSON.stringify({ document: JSON.stringify(v2doc), proof: { type: 'none' } }))
    }

    // 2周目: 変換
    for (const line of parsed) {
        const doc = line.doc

        // 自分がownerでも署名者が他人の行(自分の投稿への他人からのfav等)は取り込めない
        if (doc.signer !== oldCcid) {
            result.skippedOtherSigner++
            continue
        }

        switch (doc.type) {
            case 'message': {
                // v1のmessage IDは "m" + documentID
                if (deleteTargets.has(`m${line.documentID}`)) {
                    result.deleted++
                    continue
                }

                const body = doc.body ?? {}

                // reply/rerouteは参照先メッセージのv2上のkey(targetURI)を合成する。
                // 参照先が自分の投稿なら新CCIDに書き換え(取り込み後のkeyと一致する)。
                // 他人の投稿への参照は相手の新CCIDを知り得ないため旧CCIDのまま出力し、件数を報告する
                // (相手がサーバー側移行済みならこのURIはそのまま解決できる)。
                if (doc.schema === 'https://schema.concrnt.world/m/reply.json') {
                    let author = body.replyToMessageAuthor
                    if (author === oldCcid) {
                        author = newCcid
                        body.replyToMessageAuthor = newCcid
                    } else {
                        result.externalReferences++
                    }
                    body.targetURI = semantics.post(author, 'main', body.replyToMessageId)
                } else if (doc.schema === 'https://schema.concrnt.world/m/reroute.json') {
                    let author = body.rerouteMessageAuthor
                    if (author === oldCcid) {
                        author = newCcid
                        body.rerouteMessageAuthor = newCcid
                    } else {
                        result.externalReferences++
                    }
                    body.targetURI = semantics.post(author, 'main', body.rerouteMessageId)
                }

                // サブプロフィール投稿もmainのpostsに寄せる(サブプロフィール自体は移行しないため)。
                // コミュニティや他人のタイムラインへの配送はimportでは実行されないうえ
                // policyで拒否されるため、自分のhomeのみ引き継ぐ
                const v2doc: any = {
                    kind: 'record',
                    key: semantics.post(newCcid, 'main', `m${line.documentID}`),
                    value: body,
                    author: newCcid,
                    schema: doc.schema,
                    createdAt: doc.signedAt
                }
                const timelines: string[] = Array.isArray(doc.timelines) ? doc.timelines : []
                if (timelines.includes(homeTimelineV1)) {
                    v2doc.distributes = [semantics.homeTimeline(newCcid, 'main')]
                }

                pushLine(v2doc)
                result.convertedMessages++
                break
            }
            case 'profile': {
                // mainプロフィール(semanticID: world.concrnt.p)のみ変換。サブプロフィールはスキップ
                if (doc.semanticID !== 'world.concrnt.p') {
                    result.skippedByType.subprofile = (result.skippedByType.subprofile ?? 0) + 1
                    continue
                }
                const v1id = doc.semanticID ?? doc.id ?? `p${line.documentID}`
                if (deleteTargets.has(v1id)) {
                    result.deleted++
                    continue
                }
                pushLine({
                    kind: 'record',
                    key: semantics.profile(newCcid, 'main'),
                    value: doc.body ?? {},
                    author: newCcid,
                    schema: doc.schema,
                    createdAt: doc.signedAt
                })
                result.convertedProfiles++
                break
            }
            default: {
                const type = typeof doc.type === 'string' && doc.type !== '' ? doc.type : 'unknown'
                result.skippedByType[type] = (result.skippedByType[type] ?? 0) + 1
                break
            }
        }
    }

    return result
}

// importではdistributesのfanoutが実行されないため、タイムラインへの配送recordを明示的に生成する。
// 配送recordのdocument-reference proofは参照先の再署名済みSignedDocumentをreferencesに
// 埋め込むことで検証されるため、この処理は再署名(prepareRepositoryDump)の後に行う必要がある。
export const insertHomeTimelineRecords = (resignedLines: string[], newCcid: string): string[] => {
    const homeTimeline = semantics.homeTimeline(newCcid, 'main')
    const out: string[] = []

    for (const line of resignedLines) {
        out.push(line)

        let sd: { document: string; proof?: object }
        let doc: any
        try {
            sd = JSON.parse(line)
            doc = JSON.parse(sd.document)
        } catch (_e) {
            continue
        }
        if (doc.kind !== 'record' || !Array.isArray(doc.distributes)) continue
        if (!doc.distributes.includes(homeTimeline)) continue

        const distID = CDID.newFromString(sd.document, new Date(doc.createdAt)).toString()
        const distDoc = {
            kind: 'record',
            key: `${homeTimeline}/${distID}`,
            value: {
                href: doc.key,
                schema: doc.schema
            },
            author: newCcid,
            schema: 'https://schema.concrnt.net/reference.json',
            createdAt: doc.createdAt
        }
        out.push(
            JSON.stringify({
                document: JSON.stringify(distDoc),
                proof: {
                    type: 'document-reference',
                    href: doc.key
                },
                references: {
                    [doc.key]: sd
                }
            })
        )
    }

    return out
}

export interface V1ImportPreparation {
    lines: string[] // importRepositoryDumpに渡す最終行列
    conversion: V1ConversionResult
    resigned: number
    distributionRecords: number // 生成したタイムライン配送record数
}

// v1バックアップの取り込み準備: 変換 → 再署名 → タイムライン配送record生成。
// 結果のlinesをimportRepositoryDumpに渡すことで取り込みが完了する
export const prepareV1Import = async (api: Api, backupText: string): Promise<V1ImportPreparation> => {
    const ccid = api.authProvider.getCCID()
    const conversion = convertV1Backup(backupText, ccid)
    const prep = await prepareRepositoryDump(api, conversion.lines.join('\n'))
    const lines = insertHomeTimelineRecords(prep.lines, ccid)
    return {
        lines,
        conversion,
        resigned: prep.resigned,
        distributionRecords: lines.length - prep.lines.length
    }
}
