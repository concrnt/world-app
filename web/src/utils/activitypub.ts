export interface ApImage {
    type: 'Image'
    url: string
    name: string | null
    sensitive: boolean
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
