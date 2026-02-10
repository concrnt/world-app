import { Api } from './api'
import { ChunklineItem } from './chunkline'
import { RealtimeEvent } from './model'
import { Socket } from './socket'

export interface TimelineItemWithUpdate extends ChunklineItem {
    lastUpdate: Date
}

export class TimelineReader {
    body: TimelineItemWithUpdate[] = []
    onUpdate?: () => void
    onNewItem?: (item: ChunklineItem) => void
    socket?: Socket
    api: Api
    timelines: string[] = []
    haltUpdate: boolean = false

    hostOverride?: string

    constructor(api: Api, socket?: Socket, hostOverride?: string) {
        this.api = api
        this.socket = socket
        this.hostOverride = hostOverride
    }

    processEvent(event: RealtimeEvent) {
        switch (event.type) {
            case 'created': {
                let href = event.uri
                for (const _ in event.documents) {
                    const sd = event.documents[href]
                    if (!sd) break
                    const document = JSON.parse(sd.document)
                    if (document.schema !== 'https://schema.concrnt.net/reference.json') break
                    href = document.value.href
                }

                if (this.body.find((item) => item.href === href)) return
                const item: ChunklineItem = {
                    href: href,
                    timestamp: new Date()
                }
                this.onNewItem?.(item)
                if (this.haltUpdate) return
                const itemWithUpdate: TimelineItemWithUpdate = {
                    ...item,
                    lastUpdate: new Date()
                }
                this.body.unshift(itemWithUpdate)
                this.onUpdate?.()
                break
            }
            case 'associated': {
                const target = this.body.find((item) => item.href === event.uri)
                if (!target) {
                    console.log('Associated event for unknown item:', event.uri)
                    return
                }
                console.log('Item associated updated:', event.uri)
                target.lastUpdate = new Date()
                this.onUpdate?.()
                break
            }
            default: {
                console.log(`Unhandled event type: ${event.type}`)
            }
        }
    }

    async listen(timelines: string[]): Promise<boolean> {
        this.timelines = timelines

        let hasMore = true

        await this.api
            .getTimelineRecent(timelines)
            .then((items: ChunklineItem[]) => {
                const itemsWithUpdate = items.map((item) => Object.assign(item, { lastUpdate: new Date() }))
                this.body = itemsWithUpdate
                if (items.length < 16) {
                    hasMore = false
                }
                this.onUpdate?.()
            })
            .catch((err) => {
                console.error('Failed to load timeline:', err)
                hasMore = false
                this.body = []
                this.onUpdate?.()
            })

        this.socket?.listen(timelines, this.processEvent.bind(this))

        return hasMore
    }

    async readMore(): Promise<boolean> {
        if (this.body.length === 0) return false
        const last = this.body[this.body.length - 1]
        const items = await this.api.getTimelineRanged(this.timelines, { until: last.timestamp }, this.hostOverride)
        const newdata = items.filter((item) => !this.body.find((i) => i.href === item.href))
        const newdataWithUpdate = newdata.map((item) => Object.assign(item, { lastUpdate: new Date() }))
        if (newdata.length === 0) return false
        this.body = this.body.concat(newdataWithUpdate)
        this.onUpdate?.()
        return true
    }

    async reload(): Promise<boolean> {
        let hasMore = true
        this.haltUpdate = true
        const items = await this.api.getTimelineRecent(this.timelines)
        const itemsWithUpdate = items.map((item) => Object.assign(item, { lastUpdate: new Date() }))
        this.body = itemsWithUpdate
        if (items.length < 16) {
            hasMore = false
        }
        this.haltUpdate = false
        this.onUpdate?.()
        return hasMore
    }

    dispose() {
        this.socket?.unlisten(this.timelines, this.processEvent)
        this.onUpdate = undefined
    }
}
