import { IsCCID, NotFoundError, parseCCURI, type Document } from '@concrnt/client'
import { Client, Schemas, isStaticTimelineURI, semantics } from '@concrnt/worldlib'

// 照会(Query)の入力を「何として開くか」に解決する。
// cckv:// はドキュメントを引いてschemaで判定し、CCID単体/キー無しcckvはentity(=プロフィール)、
// https:// は静的タイムライン(manifest)として扱う。AP/Blueskyの外部URLは照会の対象外。
export type QueryTarget =
    | { kind: 'profile'; ccid: string; profileName?: string; hint?: string }
    | { kind: 'post'; uri: string }
    | { kind: 'timeline'; uri: string }
    | { kind: 'list'; uri: string }

export type QueryResolveReason = 'invalid' | 'notFound' | 'unsupported'

export class QueryResolveError extends Error {
    reason: QueryResolveReason
    constructor(reason: QueryResolveReason, message?: string) {
        super(message ?? reason)
        this.reason = reason
    }
}

export const resolveQueryTarget = async (client: Client, input: string): Promise<QueryTarget> => {
    const raw = input.trim()
    if (raw === '') throw new QueryResolveError('invalid')

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
