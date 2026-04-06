import { Client } from './client'
import { Schemas } from './schemas'
import { ListSchema } from './schemas/list'
import { Timeline } from './timeline'
import { isFulfilled, isNonNull } from './util'

export class List {
    uri: string

    title: string

    items: string[]
    communities: Timeline[] = []

    constructor(uri: string, title: string, items: string[]) {
        this.uri = uri
        this.title = title
        this.items = items
    }

    static async load(client: Client, uri: string, hint?: string): Promise<List | null> {
        const res = await client.api.getDocument<ListSchema>(uri, hint)
        if (!res) {
            return null
        }
        const list = new List(uri, res.value.title, res.value.items)

        const itemsQuery = await Promise.allSettled(
            res.value.items.map(async (item) => {
                return Timeline.load(client, item)
            })
        )

        const items: Timeline[] = itemsQuery
            .filter(isFulfilled)
            .map((r) => r.value)
            .filter(isNonNull)
        list.communities = items.filter((i) => i.schema === Schemas.communityTimeline)

        return list
    }

    async addItem(client: Client, item: string): Promise<void> {
        const latestDocument = await client.api.getDocument<ListSchema>(this.uri)
        if (!latestDocument) {
            throw new Error('List document not found')
        }

        if (latestDocument.value.items.includes(item)) {
            return
        }

        latestDocument.value.items.push(item)

        await client.api.commit(latestDocument)

        this.items = latestDocument.value.items
    }

    async removeItem(client: Client, item: string): Promise<void> {
        const latestDocument = await client.api.getDocument<ListSchema>(this.uri)
        if (!latestDocument) {
            throw new Error('List document not found')
        }

        latestDocument.value.items = latestDocument.value.items.filter((i) => i !== item)

        await client.api.commit(latestDocument)

        this.items = latestDocument.value.items
    }
}
