import { CDID, Document, SignedDocument } from '@concrnt/client'
import { Client } from './client'
import { ListSchema } from './schemas/list'
import { CachedPromise } from './cachedPromise'

export interface ListEntry {
    key: string // 実際に格納されているKVキー
    value?: any // ドキュメントのvalue (パース不能ならundefined)。参照なら { href, schema }
}

export class List {
    client: Client
    uri: string

    title: string

    toJSON() {
        return {
            uri: this.uri,
            title: this.title
        }
    }

    items = new CachedPromise<string[]>(async () => {
        const items = await this.client.api.query(
            {
                prefix: this.uri,
                limit: 100 //TODO: pagination
            },
            undefined,
            { cache: true }
        )

        const documents = items.map((i) => JSON.parse(i.document))
        return documents.map((d) => d.value.href)
    })

    entries = new CachedPromise<ListEntry[]>(async () => {
        const prefix = this.uri.endsWith('/') ? this.uri : this.uri + '/'
        const items = await this.client.api.query(
            {
                prefix,
                limit: 100 //TODO: pagination
            },
            undefined,
            { cache: true }
        )

        return items.map((sd) => {
            const key = sd.cckv ?? sd.ccfs
            let value: any
            try {
                value = JSON.parse(sd.document).value
            } catch {
                value = undefined
            }
            return { key, value }
        })
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

        const hash = CDID.newFromStringX(item)

        let key = this.uri
        if (!key.endsWith('/')) {
            key += '/'
        }
        key += hash

        const document: Document<any> = {
            kind: 'record',
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
        this.entries.reload()
        client.knownCommunities.reload()
    }

    async removeItem(client: Client, item: string): Promise<void> {
        const hash = CDID.newFromStringX(item)

        let key = this.uri
        if (!key.endsWith('/')) {
            key += '/'
        }
        key += hash

        await client.api.delete(key)
        this.items.reload()
        this.entries.reload()
        client.knownCommunities.reload()
    }
}
