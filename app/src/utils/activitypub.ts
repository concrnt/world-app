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
    to?: string[]
    cc?: string[]
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
}
