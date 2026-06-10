import { Api } from './api'
import { Document, SignedDocument } from './model'
import { TimelineItemWithUpdate } from './timelineReader'

export interface Query {
    schema?: string
    author?: string
}

export class QueryTimelineReader {
    body: TimelineItemWithUpdate[] = []
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
            .then((items: SignedDocument[]) => {
                this.body = items.map((item) => {
                    const doc: Document<any> = JSON.parse(item.document)

                    let href = item.cckv
                    if (doc.schema === 'https://schema.concrnt.net/reference.json') {
                        href = doc.value.href
                    }

                    return {
                        href: href,
                        timestamp: new Date(doc.createdAt),
                        source: prefix,
                        lastUpdate: new Date()
                    }
                })

                if (Object.keys(items).length == 0) {
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
        const records = await this.api.query({
            prefix: this.prefix,
            until: last.timestamp,
            limit: `${this.batch}`,
            ...this.query
        })

        const items = records.map((item) => {
            const doc: Document<any> = JSON.parse(item.document)

            return {
                href: item.cckv,
                timestamp: new Date(doc.createdAt),
                source: this.prefix!
            }
        })

        const newdata = items.filter((item) => !this.body.find((i) => i.href === item.href))
        const newdataWithUpdate = newdata.map((item) => Object.assign(item, { lastUpdate: new Date() }))
        if (newdata.length === 0) return false
        this.body = this.body.concat(newdataWithUpdate)
        this.onUpdate?.()
        return true
    }

    async reload(): Promise<boolean> {
        if (!this.prefix) return false
        return this.init(this.prefix, this.query, this.batch)
    }

    updateItem(href: string) {
        const item = this.body.find((i) => i.href === href)
        if (item) {
            this.api.notifyResourceUpdate(href)
            item.lastUpdate = new Date()
            this.onUpdate?.()
        } else {
            console.warn(`Item with href ${href} not found in timeline.`)
            console.log('Current items:', this.body)
        }
    }
}
