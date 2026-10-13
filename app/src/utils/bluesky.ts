import { CDID } from '@concrnt/client'

export interface BskyProfile {
    did: string
    handle: string
    displayName?: string
    avatar?: string
    description?: string
}

export interface BskyImage {
    thumb: string
    fullsize: string
    alt?: string
}

export interface BskyExternal {
    uri: string
    title?: string
    description?: string
    thumb?: string
}

export interface BskyEmbedView {
    $type?: string
    images?: BskyImage[]
    external?: BskyExternal
    media?: {
        $type?: string
        images?: BskyImage[]
        external?: BskyExternal
    }
}

export interface BskyPostView {
    uri: string
    cid: string
    author: BskyProfile
    record: {
        text?: string
        createdAt?: string
    }
    embed?: BskyEmbedView
    replyCount?: number
    repostCount?: number
    likeCount?: number
    indexedAt?: string
}

export const getPostImages = (post: BskyPostView): BskyImage[] => {
    return post.embed?.images ?? post.embed?.media?.images ?? []
}

export const getPostExternal = (post: BskyPostView): BskyExternal | undefined => {
    return post.embed?.external ?? post.embed?.media?.external
}

export const bskyProfileUrl = (handleOrDid: string): string => {
    return `https://bsky.app/profile/${handleOrDid}`
}

export const bskyPostUrl = (post: BskyPostView): string | undefined => {
    return bskyPostUrlFromAtUri(post.uri, post.author.handle)
}

// at://did/app.bsky.feed.post/rkey → bsky.app の投稿URL。handle が分かればそちらを使う(DIDでも開ける)
export const bskyPostUrlFromAtUri = (atUri: string, handle?: string): string | undefined => {
    const match = atUri.match(/^at:\/\/([^/]+)\/app\.bsky\.feed\.post\/([^/]+)$/)
    if (!match) return undefined
    return `https://bsky.app/profile/${handle || match[1]}/post/${match[2]}`
}

// atprotoブリッジ(atproto.concrnt.world)のフォローレコードキー。
// APブリッジのapFollowKeyと同じCDIDハッシュ形式(ブリッジはvalueのdidを読むためキー形状非依存)。
export const followKey = (ccid: string, did: string): string => {
    return `cckv://${ccid}/atproto.concrnt.world/follows/${CDID.newFromStringX(did).toString()}`
}

// atprotoブリッジのユーザー設定レコードキー(listenTimelines/enabled)。ブリッジが直接読む。
export const bskySettingsKey = (ccid: string): string => {
    return `cckv://${ccid}/atproto.concrnt.world/settings`
}

export const inboxKey = (ccid: string): string => {
    return `cckv://${ccid}/atproto.concrnt.world/inbox`
}

// URIがBlueskyブリッジの受信タイムライン(inboxKey)かどうか。
// Blueskyのinboxは専用schemaを持たない(t/user.json)ためschemaでは区別できず、決定的なキーで判定する
export const isBskyInboxKey = (uri: string): boolean => {
    return /^cckv:\/\/[^/]+\/atproto\.concrnt\.world\/inbox$/.test(uri)
}
