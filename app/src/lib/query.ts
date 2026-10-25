import { IsCCID, NotFoundError, parseCCURI, type Document } from '@concrnt/client'
import { Client, Schemas, isStaticTimelineURI, semantics } from '@concrnt/worldlib'

// 照会(Query)の入力を「何として開くか」に解決する。
// https://concrnt.world/ の共有URL(v2のルート)はパスから直接対象を決める(ネットワーク不要)。
// cckv:// はドキュメントを引いてschemaで判定し、CCID単体/キー無しcckvはentity(=プロフィール)、
// それ以外の https:// は静的タイムライン(manifest)として扱う。AP/Blueskyの外部URLそのものは照会の対象外。
export type QueryTarget =
    | { kind: 'profile'; ccid: string; profileName?: string; hint?: string }
    | { kind: 'post'; uri: string }
    | { kind: 'timeline'; uri: string }
    | { kind: 'list'; uri: string }
    // ActivityPubのperson/note(app: ApView、web: /activitypub/view/:uri)
    | { kind: 'apView'; uri: string }
    // Blueskyのperson/post(app: BskyView、web: /bluesky/view/:uri)
    | { kind: 'bskyView'; uri: string }

export type QueryResolveReason = 'invalid' | 'notFound' | 'unsupported'

export class QueryResolveError extends Error {
    reason: QueryResolveReason
    constructor(reason: QueryResolveReason, message?: string) {
        super(message ?? reason)
        this.reason = reason
    }
}

const CONCRNT_WORLD_HOST = 'concrnt.world'

// https://concrnt.world/... の共有URLを開く対象へ。concrnt.world のURLでなければ null。
// パスは web/src/main.tsx のルート定義と1対1:
//   profile/:ccid/:profile?(+?hint=) / post/:uri / timeline/:uri / lists/:uri /
//   activitypub/(person|note|view)/:uri / bluesky/(person|post|view)/:uri
// concrnt.world だが知らないパス(設定画面など)は unsupported、%エンコードが壊れている等は invalid
export const parseConcrntWorldURL = (input: string): QueryTarget | null => {
    let url: URL
    try {
        url = new URL(input)
    } catch {
        return null
    }
    if (url.protocol !== 'https:' || url.hostname !== CONCRNT_WORLD_HOST) return null

    const path = url.pathname.replace(/\/+$/, '')
    const decode = (s: string): string => {
        try {
            return decodeURIComponent(s)
        } catch {
            throw new QueryResolveError('invalid')
        }
    }

    let m: RegExpMatchArray | null
    if ((m = path.match(/^\/profile\/([^/]+)(?:\/([^/]+))?$/))) {
        const ccid = decode(m[1])
        if (!IsCCID(ccid)) throw new QueryResolveError('invalid')
        const profileName = m[2] ? decode(m[2]) : undefined
        return {
            kind: 'profile',
            ccid,
            profileName: profileName && profileName !== 'main' ? profileName : undefined,
            hint: url.searchParams.get('hint') ?? undefined
        }
    }
    if ((m = path.match(/^\/post\/([^/]+)$/))) return { kind: 'post', uri: decode(m[1]) }
    if ((m = path.match(/^\/timeline\/([^/]+)$/))) return { kind: 'timeline', uri: decode(m[1]) }
    if ((m = path.match(/^\/lists\/([^/]+)$/))) return { kind: 'list', uri: decode(m[1]) }
    if ((m = path.match(/^\/activitypub\/(?:person|note|view)\/([^/]+)$/))) return { kind: 'apView', uri: decode(m[1]) }
    if ((m = path.match(/^\/bluesky\/(?:person|post|view)\/([^/]+)$/))) return { kind: 'bskyView', uri: decode(m[1]) }
    throw new QueryResolveError('unsupported', `unsupported concrnt.world path: ${path}`)
}

export const resolveQueryTarget = async (client: Client, input: string): Promise<QueryTarget> => {
    const raw = input.trim()
    if (raw === '') throw new QueryResolveError('invalid')

    // https:// は既定で静的タイムライン扱いなので、concrnt.world の共有URLはその前に拾う
    const world = parseConcrntWorldURL(raw)
    if (world) return world

    if (isStaticTimelineURI(raw)) return { kind: 'timeline', uri: raw }
    if (IsCCID(raw)) return { kind: 'profile', ccid: raw }
    // parseCCURIはスキーム無しの文字列もcckvとして通すので、ここでは明示的なURIだけを受ける
    if (!raw.includes('://')) throw new QueryResolveError('invalid')

    let parsed
    try {
        parsed = parseCCURI(raw)
    } catch {
        throw new QueryResolveError('invalid')
    }
    if (parsed.scheme !== 'cckv') throw new QueryResolveError('unsupported', `unsupported scheme: ${parsed.scheme}`)

    // 表示側にはhint(cckv://owner@host/key)を外した正規形を渡し、hintは別引数で運ぶ
    const uri = `cckv://${parsed.owner}${parsed.key ? '/' + parsed.key : ''}`

    if (parsed.key === '') {
        if (IsCCID(parsed.owner)) return { kind: 'profile', ccid: parsed.owner, hint: parsed.hint }
        // alias(cckv://@example.com)はentityを引いてCCIDに寄せる
        if (!parsed.owner.startsWith('@')) throw new QueryResolveError('invalid')
        let entity
        try {
            entity = await client.api.getEntity(parsed.owner, parsed.hint)
        } catch (e) {
            if (e instanceof NotFoundError) throw new QueryResolveError('notFound')
            throw e
        }
        return { kind: 'profile', ccid: entity.author, hint: entity.value.domain }
    }

    let document: Document<unknown>
    try {
        document = await client.api.getDocument<unknown>(uri, parsed.hint)
    } catch (e) {
        if (e instanceof NotFoundError) throw new QueryResolveError('notFound')
        throw e
    }

    switch (document.schema) {
        case Schemas.userTimeline:
        case Schemas.communityTimeline:
        case Schemas.subprofileTimeline:
        case Schemas.apInboxTimeline:
            return { kind: 'timeline', uri }
        case Schemas.profile: {
            const profileName = semantics.profileNameFromURI(parsed.owner, uri)
            return {
                kind: 'profile',
                ccid: parsed.owner,
                profileName: profileName && profileName !== 'main' ? profileName : undefined,
                hint: parsed.hint
            }
        }
        case Schemas.markdownMessage:
        case Schemas.replyMessage:
        case Schemas.rerouteMessage:
        case Schemas.plaintextMessage:
        case Schemas.mediaMessage:
        case Schemas.gfmMessage:
        case Schemas.mfmMessage:
        case Schemas.apNote:
        case Schemas.atprotoRecord:
            return { kind: 'post', uri }
        case Schemas.list:
            return { kind: 'list', uri }
        default:
            throw new QueryResolveError('unsupported', `unsupported schema: ${document.schema}`)
    }
}
