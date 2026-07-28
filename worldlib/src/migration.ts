import { Api, Document, NotFoundError, PolicyEntry, RepositoryImportResult } from '@concrnt/client'
import { Client } from './client'
import { semantics } from './semantics'
import { ProfileSchema } from './schemas/'

export interface MigrationPreparation {
    lines: string[] // import対象の行(再署名済み含む)。dumpの時系列順を保持する
    total: number // dumpに含まれていた行数
    resigned: number // none proofから再署名した行数
    skipped: string[] // 再署名できずスキップした行(他人がauthorのnone proofなど)
}

// dumpを走査し、自分がauthorのnone proof commit(v1→v2移行で投入されたもの)を
// 現在のsubkeyで署名し直す。documentIDはdocument文字列+createdAtから導出されるため、
// document文字列は一切変更せずproofだけ差し替える。
export const prepareRepositoryDump = async (api: Api, jsonl: string): Promise<MigrationPreparation> => {
    const ccid = api.authProvider.getCCID()
    const lines = jsonl.split('\n').filter((line) => line.trim() !== '')

    const prepared: string[] = []
    const skipped: string[] = []
    let resigned = 0

    for (const line of lines) {
        let sd: { document: string; proof?: { type?: string } }
        try {
            sd = JSON.parse(line)
        } catch (_e) {
            skipped.push(line)
            continue
        }

        if (sd.proof?.type !== 'none') {
            // 署名済みの行はそのまま通す(パースし直すと空白等が変わる恐れがある)
            prepared.push(line)
            continue
        }

        let author: string | undefined
        try {
            author = JSON.parse(sd.document).author
        } catch (_e) {
            author = undefined
        }
        if (author !== ccid) {
            skipped.push(line)
            continue
        }

        const [signature, keyid] = await api.authProvider.signSub(sd.document)
        prepared.push(
            JSON.stringify({
                document: sd.document,
                proof: {
                    type: 'concrnt-ecrecover-subkey',
                    signature,
                    key: `cckv://${ccid}/keys/${keyid}`
                }
            })
        )
        resigned++
    }

    return { lines: prepared, total: lines.length, resigned, skipped }
}

const legacyPolicy = 'https://policy.concrnt.world/t/inline-read-write.json'
const restrictReadersPolicy = 'https://policy.concrnt.world/t/restrict-readers.json'
const writePublicPolicy = 'https://policy.concrnt.world/t/write-public.json'

// v1由来のinline-read-writeポリシー(v1では鍵垢=home-timelineのisReadPublic:false)を検出し、
// 鍵垢設定をv2の形式であるプロフィールへのrestrict-readers付与に移行する。
// あわせてtimeline上の旧ポリシーをv2のデフォルト形へ正規化する(homeのreaderリストはプロフィールへ
// 引き上げて一本化する。grantReadAccessはプロフィール側しか更新しないため、homeに残すと発散する)。
// 掃除が完了するとinline-read-write entry自体が消えて検出条件が消滅するため、
// 完了マーカーなしで毎ロード時に呼んで安全(冪等)。対象は現在開いているプロフィールのみ。
export const migrateLegacyProfilePolicies = async (client: Client): Promise<void> => {
    const ccid = client.ccid
    if (ccid === '') return
    const profile = client.currentProfile

    const timelineUris = [
        semantics.homeTimeline(ccid, profile),
        semantics.notificationTimeline(ccid, profile),
        semantics.activityTimeline(ccid, profile)
    ]
    const findLegacyEntry = (doc: Document<any> | null): PolicyEntry | undefined =>
        doc?.policy?.entries?.find((e) => e.url === legacyPolicy)
    const ignoreNotFound = (err: unknown): null => {
        if (err instanceof NotFoundError) return null
        throw err
    }

    // Phase 0: 通常キャッシュでの安価な検出。純v2アカウントは毎回ここで終わる
    // (直前のsetupDefaultTimelinesが同じURIを取得済みでキャッシュヒットする)
    let timelines = await Promise.all(timelineUris.map((uri) => client.api.getDocument<any>(uri).catch(ignoreNotFound)))
    if (!timelines.some(findLegacyEntry)) return

    // Phase 1: staleキャッシュによる誤書き込みを防ぐため、書き込み前にno-cacheで判定を確定させる
    timelines = await Promise.all(
        timelineUris.map((uri) =>
            client.api.getDocument<any>(uri, undefined, { cache: 'no-cache' }).catch(ignoreNotFound)
        )
    )
    if (!timelines.some(findLegacyEntry)) return
    const profileDoc = await client.api
        .getDocument<ProfileSchema>(semantics.profile(ccid, profile), undefined, { cache: 'no-cache' })
        .catch(ignoreNotFound)

    const homeEntry = findLegacyEntry(timelines[0])
    const legacyLocked = homeEntry?.params?.isReadPublic === false
    let profileProtected = profileDoc?.policy?.entries?.some((e) => e.url === restrictReadersPolicy) ?? false

    // Phase 2: 鍵垢のreaderリストをプロフィールのrestrict-readersへ引き上げる。
    // 既にrestrict-readersが付いている場合(前回の部分成功、またはv2 UIで設定済み)は
    // v2側のリストを正としてマージしない
    if (legacyLocked && !profileProtected && profileDoc) {
        if (profileDoc.policy?.entries?.length) {
            // 未知のポリシー構成には触らない。掃除だけすると保護が消えるため丸ごと中断
            console.warn(
                'migrateLegacyProfilePolicies: unknown policy on profile document. skipping',
                profileDoc.policy
            )
            return
        }
        const reader: unknown = homeEntry?.params?.reader
        // ownerはグローバルポリシーのowner-allowで常に読めるため、v1のreaderに含まれる自分は除く
        const entities = (Array.isArray(reader) ? reader : []).filter(
            (e): e is string => typeof e === 'string' && e !== ccid
        )
        const newProfileDoc: Document<ProfileSchema> = {
            kind: 'record',
            key: semantics.profile(ccid, profile),
            schema: profileDoc.schema,
            value: profileDoc.value,
            author: ccid,
            createdAt: new Date(),
            policy: {
                entries: [
                    {
                        url: restrictReadersPolicy,
                        params: { entities },
                        defaults: { 'record:read': 'no' }
                    }
                ]
            },
            onUpdate: 'forget'
        }
        await client.api.commit(newProfileDoc)
        client.profiles[profile] = newProfileDoc
        profileProtected = true
    }

    // Phase 3: timeline上の旧ポリシーをv2のデフォルト形へ正規化する。
    // read部(isReadPublic:false)はrestrict-readersへ変換するが、homeだけはプロフィールへ
    // 引き上げ済みのため復元しない。write部はisWritePublic:trueのみwrite-publicへ変換する
    // (falseはグローバルポリシーのowner-onlyと等価なので何も足さない)
    for (const [i, doc] of timelines.entries()) {
        const entry = findLegacyEntry(doc)
        if (!doc || !entry) continue
        const isHome = i === 0
        // プロフィールへの保護付与に失敗/未達のままhomeの旧ポリシーを消すと保護空白が生じる
        if (isHome && legacyLocked && !profileProtected) continue
        const entries = doc.policy!.entries.filter((e) => e !== entry)
        if (!isHome && entry.params?.isReadPublic === false) {
            const reader: unknown = entry.params?.reader
            entries.push({
                url: restrictReadersPolicy,
                params: {
                    entities: (Array.isArray(reader) ? reader : []).filter((e): e is string => typeof e === 'string')
                }
            })
        }
        if (entry.params?.isWritePublic === true) {
            entries.push({ url: writePublicPolicy })
        }
        const newDoc: Document<any> = {
            kind: 'record',
            key: timelineUris[i],
            schema: doc.schema,
            value: doc.value,
            author: ccid,
            createdAt: new Date(),
            policy: entries.length > 0 ? { entries } : undefined,
            onUpdate: 'forget'
        }
        await client.api.commit(newDoc)
    }
}

export interface ImportProgress {
    totalChunks: number
    doneChunks: number
    importedLines: number
    failures: RepositoryImportResult[]
}

// 時系列順を保つ必要があるため、チャンクは並列化せず逐次POSTする。
// サーバーは失敗した行だけを返すので、返却値は全チャンクの失敗行の集約。
export const importRepositoryDump = async (
    api: Api,
    host: string,
    lines: string[],
    opts?: { chunkSize?: number; onProgress?: (progress: ImportProgress) => void }
): Promise<RepositoryImportResult[]> => {
    const chunkSize = opts?.chunkSize ?? 200
    const chunks: string[][] = []
    for (let i = 0; i < lines.length; i += chunkSize) {
        chunks.push(lines.slice(i, i + chunkSize))
    }

    const failures: RepositoryImportResult[] = []
    let importedLines = 0

    for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i]
        const results = await api.importRepository(chunk.join('\n'), host)
        failures.push(...results)
        importedLines += chunk.length - results.length

        opts?.onProgress?.({
            totalChunks: chunks.length,
            doneChunks: i + 1,
            importedLines,
            failures
        })
    }

    return failures
}
