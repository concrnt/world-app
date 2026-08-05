import { CDID, renderUriTemplate } from '@concrnt/client'
import { type Client } from '@concrnt/worldlib'

export interface ApImage {
    type: 'Image'
    url: string
    name: string | null
    sensitive: boolean
}

// APブリッジ(activitypub.concrnt.world)のフォローレコードキー。
// ハッシュはブリッジ側の CDID.makeHash と同一(keccak256先頭15バイトのx-CDID)。
export const apFollowKey = (ccid: string, actorURI: string): string => {
    return `cckv://${ccid}/activitypub.concrnt.world/follows/${CDID.newFromStringX(actorURI).toString()}`
}

// APブリッジのユーザー設定レコードキー(listenTimelines等)。ブリッジが直接読む。
export const apSettingsKey = (ccid: string): string => {
    return `cckv://${ccid}/activitypub.concrnt.world/settings`
}

// APブリッジのホームストリーム(受信タイムライン)。ブリッジがインバウンド投稿を配布する先。
export const apInboxKey = (ccid: string): string => {
    return `cckv://${ccid}/activitypub.concrnt.world/inbox`
}

// noteはほぼ不変・actorの更新もSWR(stale表示+裏で再取得)で追従できるため1hで共通
export const AP_RESOLVE_TTL = 1000 * 60 * 60
// 死んだインスタンス/410はブリッジが404で返すため、失敗resolveの連打を5分抑止
export const AP_RESOLVE_NEGATIVE_TTL = 1000 * 60 * 5

// resolveはネットワーク素通しだと表示中のノート数×2(note+author)のリクエストが飛ぶため、
// 通常メッセージと同じfetchWithCache(KVS永続+in-flight dedup+negative cache)に乗せる
export const resolveApObject = async (client: Client, uri: string): Promise<ApObject | null> => {
    const endpoint = renderUriTemplate(client.server, 'net.concrnt.activitypub.resolve', { uri })
    const res = await client.api.fetchWithCache<Partial<ApObject> | null>(client.server.domain, endpoint, `ap:${uri}`, {
        TTL: AP_RESOLVE_TTL,
        negativeTTL: AP_RESOLVE_NEGATIVE_TTL
    })
    return res ? new ApObject(res) : null
}

export class ApObject {
    type: string = 'Object'
    id: string = ''
    inbox?: string
    outbox?: string
    followers?: string
    following?: string
    featured?: string
    sharedInbox?: string
    endpoints?: {
        sharedInbox: string
    }
    url?: string
    preferredUsername?: string
    name?: string
    summary?: string
    _misskey_summary?: string
    icon?: ApImage | ApImage[]
    image?: ApImage | ApImage[]
    tag?: ApObject | ApObject[]
    manuallyApprovesFollowers?: boolean
    discoverable?: boolean
    publicKey?: {
        id: string
        type: string
        owner: string
        publicKeyPem: string
    }
    attachment?: ApObject | ApObject[]
    attributedTo?: string
    content?: string
    _misskey_content?: string
    published?: string
    // fedifyの再シリアライズ経路は単一要素を配列でなく文字列で返すため両方あり得る
    to?: string | string[]
    cc?: string | string[]
    inReplyTo?: string

    constructor(ld: Partial<ApObject>) {
        Object.assign(this, ld)
    }

    getIcons(): ApImage[] {
        if (!this.icon) return []
        if (Array.isArray(this.icon)) return this.icon
        return [this.icon]
    }

    getImages(): ApImage[] {
        if (!this.image) return []
        if (Array.isArray(this.image)) return this.image
        return [this.image]
    }

    getTags(): ApObject[] {
        if (!this.tag) return []
        if (Array.isArray(this.tag)) return this.tag
        return [this.tag]
    }

    getAttachments(): ApObject[] {
        if (!this.attachment) return []
        if (Array.isArray(this.attachment)) return this.attachment
        return [this.attachment]
    }

    // Mastodon準拠: toにPublic=public / ccにPublic=unlisted / followers URI宛=followers / それ以外=direct。
    // 宛先情報が無い場合はpublic、author未解決でfollowersURI不明ならdirect断定を避けてfollowersに倒す。
    getVisibility(followersURI?: string): 'public' | 'unlisted' | 'followers' | 'direct' {
        const to = this.to ? [this.to].flat() : []
        const cc = this.cc ? [this.cc].flat() : []
        if (to.length === 0 && cc.length === 0) return 'public'
        const isPublic = (uri: string): boolean =>
            uri === 'https://www.w3.org/ns/activitystreams#Public' || uri === 'as:Public' || uri === 'Public'
        if (to.some(isPublic)) return 'public'
        if (cc.some(isPublic)) return 'unlisted'
        if (!followersURI || to.includes(followersURI) || cc.includes(followersURI)) return 'followers'
        return 'direct'
    }
}
