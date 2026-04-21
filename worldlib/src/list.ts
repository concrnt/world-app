import { CDID, Document, SignedDocument } from '@concrnt/client'
import { Client } from './client'
import { Schemas } from './schemas'
import { ListSchema } from './schemas/list'
import { Timeline } from './timeline'
import { isFulfilled, isNonNull } from './util'

export class List {
    uri: string

    title: string

    items: string[] = []
    communityIds: string[] = []

    constructor(uri: string, title: string) {
        this.uri = uri
        this.title = title
    }

    static async load(client: Client, uri: string, hint?: string): Promise<List | null> {
        const res = await client.api.getDocument<ListSchema>(uri, hint)
        if (!res) {
            return null
        }
        const list = new List(uri, res.value.title)
        await list.loadItems(client)

        return list
    }

    static async loadFromSD(client: Client, sd: SignedDocument): Promise<List> {
        const doc = JSON.parse(sd.document)
        const list = new List(sd.cckv ?? sd.ccfs, doc.value.title)

        await list.loadItems(client)
        return list
    }

    async loadItems(client: Client): Promise<void> {
        const items = await client.api.query({
            prefix: this.uri
        })

        const documents = items.map((i) => JSON.parse(i.document))
        this.items = documents.map((d) => d.value.href)
        this.communityIds = documents
            .filter((d) => d.value.schema === Schemas.communityTimeline)
            .map((d) => d.value.href)
    }

    communities(client: Client): Promise<Timeline[]> {
        return Promise.allSettled(this.communityIds.map((id) => Timeline.load(client, id))).then((results) =>
            results
                .filter(isFulfilled)
                .map((r) => r.value)
                .filter(isNonNull)
        )
    }

    async addItem(client: Client, item: string, schema?: string): Promise<void> {
        if (!schema) {
            const target = await client.api.getDocument(item)
            schema = target.schema
        }

        const hash = CDID.makeHash(new TextEncoder().encode(item))

        let key = this.uri
        if (!key.endsWith('/')) {
            key += '/'
        }
        key += hash

        const document: Document<any> = {
            key: key,
            author: client.ccid,
            schema: 'https://schema.concrnt.net/reference.json',
            value: {
                href: item,
                schema: schema
            },
            createdAt: new Date()
        }

        await client.api.commit(document)
        await this.loadItems(client)
    }

    async removeItem(client: Client, item: string): Promise<void> {
        const hash = CDID.makeHash(new TextEncoder().encode(item))

        let key = this.uri
        if (!key.endsWith('/')) {
            key += '/'
        }
        key += hash

        await client.api.delete(key)
        await this.loadItems(client)
    }
}
