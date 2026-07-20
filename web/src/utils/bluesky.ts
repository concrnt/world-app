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
    const match = post.uri.match(/^at:\/\/([^/]+)\/app\.bsky\.feed\.post\/([^/]+)$/)
    if (!match) return undefined
    return `https://bsky.app/profile/${post.author.handle || match[1]}/post/${match[2]}`
}

export const followKey = (ccid: string, did: string): string => {
    return `cckv://${ccid}/atproto.concrnt.world/follows/${did}`
}

export const inboxKey = (ccid: string): string => {
    return `cckv://${ccid}/atproto.concrnt.world/inbox`
}
