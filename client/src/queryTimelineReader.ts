import { Api } from './api'
import { ChunklineItem } from './chunkline'
import { Document } from './model'

export interface Query {
    schema?: string
    author?: string
}

export class QueryTimelineReader {
    body: ChunklineItem[] = []
    onUpdate?: () => void
    api: Api
    prefix?: string
    query: Query = {}
    batch: number = 16

    constructor(api: Api) {
        this.api = api
    }

    async init(prefix: string, query: Query, limit: number): Promise<boolean> {
        this.prefix = prefix
        let hasMore = true
        this.batch = limit
        this.query = query

        await this.api
            .query({
                prefix: this.prefix,
                ...query
            })
            .then((items: Record<string, Document<any>>) => {
                this.body = Object.keys(items).map((key) => {
                    return {
                        href: key,
                        timestamp: new Date(items[key].createdAt),
                        source: prefix
                    }
                })

                if (Object.keys(items).length < limit) {
                    hasMore = false
                }

                this.onUpdate?.()
            })

        return hasMore
    }

    async readMore(): Promise<boolean> {
        if (!this.prefix) return false
        if (this.body.length === 0) return false
        const last = this.body[this.body.length - 1]
        const records = await this.api.query<Document<any>>({
            prefix: this.prefix,
            until: last.timestamp.toISOString(),
            limit: `${this.batch}`,
            ...this.query
        })

        const items = Object.keys(records).map((key) => {
            return {
                href: key,
                timestamp: new Date(records[key].createdAt),
                source: this.prefix!
            }
        })

        const newdata = items.filter((item) => !this.body.find((i) => i.href === item.href))
        if (newdata.length === 0) return false
        this.body = this.body.concat(newdata)
        this.onUpdate?.()
        return true
    }

    async reload(): Promise<boolean> {
        if (!this.prefix) return false
        return this.init(this.prefix, this.query, this.batch)
    }
}
