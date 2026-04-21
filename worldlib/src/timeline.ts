import { CommunityTimelineSchema } from './schemas/'
import { Client } from './client'
import { SignedDocument } from '@concrnt/client'

export class Timeline {
    uri: string

    schema: string

    name: string
    shortname?: string
    description?: string
    icon?: string
    banner?: string

    constructor(uri: string, schema: string, value: CommunityTimelineSchema) {
        this.uri = uri
        this.schema = schema
        this.name = value.name
        this.shortname = value.shortname
        this.description = value.description
        this.icon = value.icon
        this.banner = value.banner
    }

    static async load(client: Client, uri: string, hint?: string): Promise<Timeline | null> {
        const res = await client.api.getDocument<CommunityTimelineSchema>(uri, hint)
        if (!res) {
            return null
        }
        const timeline = new Timeline(uri, res.schema, res.value)

        return timeline
    }

    static loadFromSD(sd: SignedDocument): Timeline {
        const doc = JSON.parse(sd.document)
        const timeline = new Timeline(sd.cckv ?? sd.ccfs, doc.schema, doc.value)
        return timeline
    }

    static loadFromReferenceSD(client: Client, sd: SignedDocument): Promise<Timeline | null> {
        const doc = JSON.parse(sd.document)
        if (doc.schema === 'https://schema.concrnt.net/reference.json') {
            return Timeline.load(client, doc.value.href)
        } else {
            const timeline = new Timeline(sd.cckv ?? sd.ccfs, doc.schema, doc.value)
            return Promise.resolve(timeline)
        }
    }
}
