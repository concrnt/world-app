import { Api } from './api'
import { ChunklineItem } from './chunkline'

export interface TimelineItemWithUpdate extends ChunklineItem {
    lastUpdate: Date
}

export class TimelineReader {
    body: TimelineItemWithUpdate[] = []
    onUpdate?: () => void
    onNewItem?: (item: ChunklineItem) => void
    api: Api
    timelines: string[] = []
    haltUpdate: boolean = false

    hostOverride?: string

    constructor(api: Api, hostOverride?: string) {
        this.api = api
        this.hostOverride = hostOverride
    }

    async listen(timelines: string[]): Promise<boolean> {
        this.timelines = timelines

        let hasMore = true

        await this.api.getTimelineRecent(timelines).then((items: ChunklineItem[]) => {
            const itemsWithUpdate = items.map((item) => Object.assign(item, { lastUpdate: new Date() }))
            this.body = itemsWithUpdate
            if (items.length < 16) {
                hasMore = false
            }
            this.onUpdate?.()
        })

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
        this.onUpdate = undefined
    }
}
