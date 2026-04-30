import { CDID, Document, SignedDocument } from '@concrnt/client'
import { Client } from './client'
import { ListSchema } from './schemas/list'
import { CachedPromise } from './cachedPromise'

export class List {
    client: Client
    uri: string

    title: string

    items = new CachedPromise<string[]>(async () => {
        const items = await this.client.api.query({
            prefix: this.uri
        })

        const documents = items.map((i) => JSON.parse(i.document))
        return documents.map((d) => d.value.href)
    })

    constructor(client: Client, uri: string, title: string) {
        this.client = client
        this.uri = uri
        this.title = title
    }

    static async load(client: Client, uri: string, hint?: string): Promise<List | null> {
        const res = await client.api.getDocument<ListSchema>(uri, hint)
        if (!res) {
            return null
        }
        const list = new List(client, uri, res.value.name)

        return list
    }

    static async loadFromSD(client: Client, sd: SignedDocument): Promise<List> {
        const doc = JSON.parse(sd.document)
        const list = new List(client, sd.cckv ?? sd.ccfs, doc.value.name)

        return list
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
        this.items.reload()
        client.knownCommunities.reload()
    }

    async removeItem(client: Client, item: string): Promise<void> {
        const hash = CDID.makeHash(new TextEncoder().encode(item))

        let key = this.uri
        if (!key.endsWith('/')) {
            key += '/'
        }
        key += hash

        await client.api.delete(key)
        this.items.reload()
        client.knownCommunities.reload()
    }
}
