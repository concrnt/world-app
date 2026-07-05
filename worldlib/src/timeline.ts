import { CommunityTimelineSchema } from './schemas/'
import { Client } from './client'
import { Document, Policy, SignedDocument } from '@concrnt/client'

export class Timeline {
    uri: string

    schema: string
    author: string
    policy?: Policy

    name: string
    shortname?: string
    description?: string
    icon?: string
    banner?: string

    toJSON() {
        return {
            uri: this.uri,
            schema: this.schema,
            author: this.author,
            policy: this.policy,
            name: this.name,
            shortname: this.shortname,
            description: this.description,
            icon: this.icon,
            banner: this.banner
        }
    }

    constructor(uri: string, document: Document<CommunityTimelineSchema>) {
        this.uri = uri
        this.schema = document.schema
        this.author = document.author
        this.policy = document.policy
        this.name = document.value.name
        this.shortname = document.value.shortname
        this.description = document.value.description
        this.icon = document.value.icon
        this.banner = document.value.banner
    }

    // restrict-readers policyが設定されている場合は閲覧を許可されたccidのリストを、
    // 設定されていない場合はnullを返す
    restrictReaders(): string[] | null {
        const entry = this.policy?.entries?.find(
            (e) => e.url === 'https://policy.concrnt.world/t/restrict-readers.json'
        )
        if (!entry) return null
        return entry.params?.entities ?? []
    }

    isRestrictedFor(ccid: string): boolean {
        const readers = this.restrictReaders()
        if (readers === null) return false
        return this.author !== ccid && !readers.includes(ccid)
    }

    static async load(client: Client, uri: string, hint?: string): Promise<Timeline | null> {
        const res = await client.api.getDocument<CommunityTimelineSchema>(uri, hint)
        if (!res) {
            return null
        }
        const timeline = new Timeline(uri, res)

        return timeline
    }

    static loadFromSD(sd: SignedDocument): Timeline {
        const doc = JSON.parse(sd.document)
        const timeline = new Timeline(sd.cckv ?? sd.ccfs, doc)
        return timeline
    }

    static loadFromReferenceSD(client: Client, sd: SignedDocument): Promise<Timeline | null> {
        const doc = JSON.parse(sd.document)
        if (doc.schema === 'https://schema.concrnt.net/reference.json') {
            return Timeline.load(client, doc.value.href)
        } else {
            const timeline = new Timeline(sd.cckv ?? sd.ccfs, doc)
            return Promise.resolve(timeline)
        }
    }
}
