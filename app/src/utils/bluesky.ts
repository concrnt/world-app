import { CDID, renderUriTemplate, type FetchOptions } from '@concrnt/client'
import { type Client } from '@concrnt/worldlib'

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
    aspectRatio?: { width: number; height: number }
}

// com.atproto.label.defs#label(appview が post view に付ける。自己ラベルは src=投稿者DID)
export interface BskyLabel {
    src?: string
    uri?: string
    cid?: string
    val: string
    neg?: boolean
    cts?: string
}

export interface BskyExternal {
    uri: string
    title?: string
    description?: string
    thumb?: string
}

// app.bsky.embed.video#view。playlist は HLS の master m3u8
export interface BskyVideo {
    playlist: string
    thumbnail?: string
    alt?: string
    aspectRatio?: { width: number; height: number }
}

export interface BskyEmbedView {
    $type?: string
    images?: BskyImage[]
    external?: BskyExternal
    playlist?: string
    thumbnail?: string
    alt?: string
    aspectRatio?: { width: number; height: number }
    media?: {
        $type?: string
        images?: BskyImage[]
        external?: BskyExternal
        playlist?: string
        thumbnail?: string
        alt?: string
        aspectRatio?: { width: number; height: number }
    }
}

export interface BskyFacet {
    index: { byteStart: number; byteEnd: number }
    features: {
        $type?: string // app.bsky.richtext.facet#link | #mention | #tag
        uri?: string // link
        did?: string // mention
        tag?: string // tag
    }[]
}

export interface BskyPostView {
    uri: string
    cid: string
    author: BskyProfile
    record: {
        text?: string
        createdAt?: string
        // app.bsky.feed.post のリプライ参照(StrongRef)。リプライ元の表示に使う
        reply?: {
            parent?: { uri: string; cid?: string }
            root?: { uri: string; cid?: string }
        }
        // 投稿者の自己ラベル(com.atproto.label.defs#selfLabels)。appview は labels にも展開するが念のため両方読む
        labels?: { values?: { val: string }[] }
        // app.bsky.richtext.facet。本文中のリンク/メンション/タグの位置(UTF-8バイトオフセット)と実体
        facets?: BskyFacet[]
    }
    embed?: BskyEmbedView
    // appview が付けたモデレーションラベル(自己ラベル+ラベラーのもの)
    labels?: BskyLabel[]
    // ブリッジがconcrntから輸出した投稿なら、元のcckv URI(ブリッジのresolveが付加する)。
    // APブリッジのNote URLからcckv URIを取り出す(parseBridgeNoteURL)のと同じ役割
    concrntURI?: string
    replyCount?: number
    repostCount?: number
    likeCount?: number
    indexedAt?: string
}

// app.bsky.feed.getAuthorFeed の1行(ブリッジ world.concrnt.atproto.authorFeed が返す形)。
// reason はリポスト(app.bsky.feed.defs#reasonRepost)のとき付く。post はリポスト元の投稿そのもの
export interface BskyFeedItem {
    post: BskyPostView
    reason?: {
        $type?: string
        by?: BskyProfile
        indexedAt?: string
    }
}

export interface BskyAuthorFeed {
    feed: BskyFeedItem[]
    cursor?: string
}

// AP の AP_RESOLVE_TTL と同じ判断: post view/profile は SWR(stale表示+裏で再取得)で追従できる
export const BSKY_RESOLVE_TTL = 1000 * 60 * 60
// 削除済み/未存在はブリッジが404で返すため、失敗resolveの連打を5分抑止
export const BSKY_RESOLVE_NEGATIVE_TTL = 1000 * 60 * 5

// resolveはネットワーク素通しだと表示のたび(再マウント・同一投稿の行+リプライ元+カード)にブリッジへ飛ぶため、
// resolveApObject と同じ fetchWithCache(KVS永続+in-flight dedup+negative cache)に乗せる。
// 負キャッシュヒット時はnull、初回404はNotFoundErrorになる。
// client.server はコールド起動時に placeholder(endpoints 空)のことがあるので、callConcrntApi と同じく getServer で引く
export const resolveBskyPost = async (
    client: Client,
    atUri: string,
    opts?: FetchOptions<BskyPostView | null>
): Promise<BskyPostView | null> => {
    const server = await client.api.getServer(client.server.domain)
    const endpoint = renderUriTemplate(server, 'world.concrnt.atproto.resolve', { uri: atUri })
    return client.api.fetchWithCache<BskyPostView | null>(client.server.domain, endpoint, `bsky:${atUri}`, {
        TTL: BSKY_RESOLVE_TTL,
        negativeTTL: BSKY_RESOLVE_NEGATIVE_TTL,
        ...opts
    })
}

// target は DID または handle
export const resolveBskyActor = async (
    client: Client,
    target: string,
    opts?: FetchOptions<BskyProfile | null>
): Promise<BskyProfile | null> => {
    const server = await client.api.getServer(client.server.domain)
    const endpoint = renderUriTemplate(server, 'world.concrnt.atproto.resolveActor', { target })
    return client.api.fetchWithCache<BskyProfile | null>(client.server.domain, endpoint, `bsky-actor:${target}`, {
        TTL: BSKY_RESOLVE_TTL,
        negativeTTL: BSKY_RESOLVE_NEGATIVE_TTL,
        ...opts
    })
}

export interface BskyBridgeInfo {
    serviceCcid: string
}

// 投稿単体ページが毎マウントで serviceCcid を引くだけに使う。設定画面は最新値が要るので callConcrntApi のまま
export const getBskyBridgeInfo = async (client: Client): Promise<BskyBridgeInfo> => {
    const server = await client.api.getServer(client.server.domain)
    const endpoint = renderUriTemplate(server, 'world.concrnt.atproto.info', {})
    return client.api.fetchWithCache<BskyBridgeInfo>(client.server.domain, endpoint, 'bsky:info', {
        TTL: BSKY_RESOLVE_TTL
    })
}

export const getPostImages = (post: BskyPostView): BskyImage[] => {
    return post.embed?.images ?? post.embed?.media?.images ?? []
}

export const getPostExternal = (post: BskyPostView): BskyExternal | undefined => {
    return post.embed?.external ?? post.embed?.media?.external
}

export const getPostVideo = (post: BskyPostView): BskyVideo | undefined => {
    if (post.embed?.playlist) return post.embed as BskyVideo
    if (post.embed?.media?.playlist) return post.embed.media as BskyVideo
    return undefined
}

// Blueskyのモデレーションラベル → concrnt の medias[].flag(warn/nude/porn/hard)。
// メディアを隠す対象の global label だけを見る(spam 等の投稿全体向けラベルは対象外)。
// 複数付いているときは先に並ぶものを優先する
const MEDIA_LABEL_FLAGS: [label: string, flag: string][] = [
    ['porn', 'porn'],
    ['graphic-media', 'hard'],
    ['gore', 'hard'], // graphic-media の旧名
    ['nudity', 'nude'],
    ['sexual', 'warn'],
    ['!hide', 'warn'],
    ['!warn', 'warn']
]

export const getPostMediaFlag = (post: BskyPostView): string | undefined => {
    const vals = new Set<string>()
    for (const label of post.labels ?? []) {
        // neg は取り消しラベル
        if (!label.neg) vals.add(label.val)
    }
    for (const label of post.record.labels?.values ?? []) vals.add(label.val)
    return MEDIA_LABEL_FLAGS.find(([label]) => vals.has(label))?.[1]
}

// 画像embedを MediaGallery の medias 形式へ(ActivitypubNote の getMedias と同じ役割)。
// ラベルは投稿単位なので全画像に同じ flag を付ける
export const getPostMedias = (
    post: BskyPostView
): {
    mediaURL: string
    mediaType: string
    thumbnailURL?: string
    altText?: string
    flag?: string
    aspectRatio?: { width: number; height: number }
}[] => {
    const flag = getPostMediaFlag(post)
    const video = getPostVideo(post)
    if (video) {
        // Bluesky では画像と動画は排他。mediaType は HLS の実 MIME で、MediaViewer 側が hls.js に振り分ける
        return [
            {
                mediaURL: video.playlist,
                mediaType: 'application/vnd.apple.mpegurl',
                thumbnailURL: video.thumbnail,
                altText: video.alt || undefined,
                flag,
                aspectRatio: video.aspectRatio
            }
        ]
    }
    return getPostImages(post).map((image) => {
        // CDNのURLは .../<cid>@jpeg のように末尾に形式が付く
        const ext = image.fullsize.match(/@(\w+)$/)?.[1]
        return {
            mediaURL: image.fullsize,
            mediaType: ext ? `image/${ext}` : 'image/*',
            thumbnailURL: image.thumb,
            altText: image.alt || undefined,
            flag
        }
    })
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

// ブリッジがミラーした投稿のレコードキー(ブリッジ側 toconcrnt.InboxKey と同一の決定的導出)。
// serviceCcid はブリッジのサービスアカウント(world.concrnt.atproto.info の serviceCcid)。
// APブリッジの apNoteKey と同じ CDID ハッシュ形式
export const bskyRecordKey = (serviceCcid: string, atUri: string): string => {
    return `cckv://${serviceCcid}/atproto.concrnt.world/inbox/${CDID.newFromStringX(atUri).toString()}`
}

// URIがBlueskyブリッジの受信タイムライン(inboxKey)かどうか。
// Blueskyのinboxは専用schemaを持たない(t/user.json)ためschemaでは区別できず、決定的なキーで判定する
export const isBskyInboxKey = (uri: string): boolean => {
    return /^cckv:\/\/[^/]+\/atproto\.concrnt\.world\/inbox$/.test(uri)
}
