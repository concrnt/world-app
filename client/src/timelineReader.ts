import { Api } from './api'
import { CDID } from './cdid'
import { ChunklineItem } from './chunkline'
import { RealtimeEvent } from './model'
import { Socket } from './socket'
import { liveReaders, readerState, recordRealtime } from './realtimeDiagnostics'

export interface TimelineItemWithUpdate extends ChunklineItem {
    lastUpdate: Date
}

export class TimelineReader {
    body: TimelineItemWithUpdate[] = []
    chunkedBody: TimelineItemWithUpdate[][] = []

    onUpdate?: () => void
    onNewItem?: (item: ChunklineItem) => void
    socket?: Socket
    api: Api
    timelines: string[] = []
    haltUpdate: boolean = false
    // 先頭ページをサーバーから取得できたか(listen/reload成功でtrue)。
    // 呼び出し側がbodyをスナップショットでseedしている場合に、本物へ差し替えてよいかの判定に使う
    headLoaded: boolean = false
    // realtimeDiagnosticsで後から読む。届いたcreatedイベントの行き先(バッファ/重複/haltUpdateで破棄/挿入)の件数と、
    // 呼び出し側が記録する描画の依頼・commit時刻(依頼だけ進んでcommitが止まっていれば描画側で詰まっている)
    stats: {
        lastEventAt?: string
        buffered: number
        duplicate: number
        halted: number
        inserted: number
        renderRequestedAt?: string
        renderCommittedAt?: string
    } = { buffered: 0, duplicate: 0, halted: 0, inserted: 0 }

    hostOverride?: string

    // listen/unlistenで同一のコールバックidentityを渡すために保持する
    private readonly boundProcessEvent: (event: RealtimeEvent) => void
    private readonly boundCatchUp: () => void

    // 先頭取得中に届いたsocketイベントの一時置き場(取得完了後に再生する)。nullなら通常配送
    pendingEvents: RealtimeEvent[] | null = null
    // 先頭取得の時点でsocketが未接続だった=接続完了までの新着を取りこぼしている可能性がある
    private needsCatchUp = false

    constructor(api: Api, socket?: Socket, hostOverride?: string) {
        this.api = api
        this.socket = socket
        this.hostOverride = hostOverride
        this.boundProcessEvent = this.processEvent.bind(this)
        this.boundCatchUp = this.catchUp.bind(this)
    }

    processEvent(event: RealtimeEvent) {
        this.stats.lastEventAt = new Date().toISOString()
        if (this.pendingEvents) {
            this.stats.buffered++
            this.pendingEvents.push(event)
            return
        }
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

                if (this.body.find((item) => item.href === href)) {
                    this.stats.duplicate++
                    return
                }
                const item: ChunklineItem = {
                    href: href,
                    source: event.source,
                    timestamp: new Date()
                }
                this.onNewItem?.(item)
                if (this.haltUpdate) {
                    this.stats.halted++
                    recordRealtime('reader dropped while halted', href)
                    return
                }
                this.stats.inserted++
                const itemWithUpdate: TimelineItemWithUpdate = {
                    ...item,
                    lastUpdate: new Date()
                }
                this.body.unshift(itemWithUpdate)
                this.chunkedBody.unshift([itemWithUpdate])
                this.onUpdate?.()
                break
            }
            case 'associated':
            case 'unassociated': {
                const target = this.body.find((item) => item.href === event.uri)
                if (!target) return
                target.lastUpdate = new Date()
                this.onUpdate?.()
                break
            }
            case 'deleted': {
                // 配信の非掲載では参照レコード <timeline>/<hrefのハッシュCDID> の削除だけが届く(documentsは付かない)
                const removedSegment = event.uri.slice(event.uri.lastIndexOf('/') + 1)
                this.body = this.body.filter(
                    (item) =>
                        !item.href ||
                        (item.href !== event.uri && CDID.newFromStringX(item.href).toString() !== removedSegment)
                )
                this.onUpdate?.()
                break
            }
            default: {
                recordRealtime('reader unhandled event', event.type)
            }
        }
    }

    async listen(timelines: string[]): Promise<boolean> {
        this.timelines = timelines
        liveReaders.add(this)
        recordRealtime('reader listen', timelines)

        let hasMore = true

        // 先頭取得より前に購読しておき、取得中のイベントはバッファして取得後に再生する
        // (取得後に購読すると、その間の新着が落ちる)。socketがまだ開いていなければ
        // open時にcatch-upで埋める
        this.pendingEvents = []
        this.socket?.listen(timelines, this.boundProcessEvent)
        this.socket?.addOpenListener(this.boundCatchUp)
        this.needsCatchUp = !(this.socket?.isOpen ?? true)

        await this.api
            .getTimelineRecent(timelines, this.hostOverride)
            .then((items: ChunklineItem[]) => {
                const itemsWithUpdate = items.map((item) => Object.assign(item, { lastUpdate: new Date() }))
                this.body = [...itemsWithUpdate]
                this.chunkedBody = [[...itemsWithUpdate]]
                this.headLoaded = true
                if (items.length < 16) {
                    hasMore = false
                }
            })
            .catch((err) => {
                console.error('Failed to load timeline:', err)
                // 呼び出し側がスナップショットをseed済みの場合はオフラインでもそれを残す(通常は空のまま)
                hasMore = this.body.length >= 16
            })

        const pending = this.pendingEvents
        this.pendingEvents = null
        for (const event of pending) {
            this.processEvent(event)
        }
        this.onUpdate?.()

        return hasMore
    }

    // socketのopen時(初回・再接続)に先頭ページを取り直し、まだ持っていない新着だけを先頭に足す。
    // (timeline.recentはsinceを受け付けないため先頭ページ丸ごと取り直してhrefで差分を取る。
    // 隙間が1ページを超える大量の新着は取りこぼすが、pull-to-refreshと同じ範囲)
    // 初回openで先頭取得時点から購読済みだった(needsCatchUpがfalse)なら隙間はない。
    // 再接続時は切断中のイベントを取りこぼしているので毎回行う
    private catchUpDone = false
    async catchUp(): Promise<void> {
        if (this.body.length === 0) return
        if (!this.catchUpDone && !this.needsCatchUp) {
            this.catchUpDone = true
            return
        }
        this.catchUpDone = true
        this.needsCatchUp = false

        const items = await this.api
            .getTimelineRecent(this.timelines, this.hostOverride)
            .catch((err): ChunklineItem[] => {
                console.error('Failed to catch up timeline:', err)
                return []
            })
        const newdata = items
            .filter((item) => !this.body.find((i) => i.href === item.href))
            .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
        recordRealtime('reader catch up', { timelines: this.timelines, added: newdata.length })
        if (newdata.length === 0) return

        // 古い順にonNewItemへ渡し、created eventと同じ経路で扱う(haltUpdate中はバッジのみ)
        for (const item of [...newdata].reverse()) {
            this.onNewItem?.(item)
        }
        if (this.haltUpdate) return
        const newdataWithUpdate = newdata.map((item) => Object.assign(item, { lastUpdate: new Date() }))
        this.body = [...newdataWithUpdate, ...this.body]
        this.chunkedBody.unshift(newdataWithUpdate)
        this.onUpdate?.()
    }

    async readMore(limit: number = 4): Promise<boolean> {
        if (this.body.length === 0) return false
        const last = this.body[this.body.length - 1]
        const items = await this.api.getTimelineRanged(
            this.timelines,
            { until: last.timestamp, limit: limit },
            this.hostOverride
        )
        const newdata = items.filter(
            (item) => !this.body.find((i) => i.timestamp.getTime() === item.timestamp.getTime())
        )
        const newdataWithUpdate = newdata.map((item) => Object.assign(item, { lastUpdate: new Date() }))
        this.body = this.body.concat(newdataWithUpdate)
        this.chunkedBody.push(newdataWithUpdate)
        this.onUpdate?.()
        return items.length >= limit
    }

    async reload(): Promise<boolean> {
        let hasMore = true
        this.haltUpdate = true
        const items = await this.api.getTimelineRecent(this.timelines, this.hostOverride)
        const itemsWithUpdate = items.map((item) => Object.assign(item, { lastUpdate: new Date() }))
        this.body = itemsWithUpdate
        this.chunkedBody = [itemsWithUpdate]
        this.headLoaded = true
        if (items.length < 16) {
            hasMore = false
        }
        this.haltUpdate = false
        this.onUpdate?.()
        return hasMore
    }

    updateItem(href: string) {
        const item = this.body.find((i) => i.href === href)
        if (item) {
            this.api.notifyResourceUpdate(href)
            item.lastUpdate = new Date()
            this.onUpdate?.()
        }
    }

    // dispose()で解除したsocket購読を再開する。bodyは保持されたままなので、
    // onUpdate/onNewItemを再設定してから呼べば既存インスタンスをそのまま使い続けられる
    resume() {
        liveReaders.add(this)
        recordRealtime('reader resume', this.timelines)
        this.socket?.listen(this.timelines, this.boundProcessEvent)
        this.socket?.addOpenListener(this.boundCatchUp)
        // 非表示中(購読解除中)の新着は取りこぼしているので、接続済みなら今すぐ取り直す
        if (this.socket?.isOpen) {
            this.catchUp()
        }
    }

    dispose() {
        liveReaders.delete(this)
        recordRealtime('reader dispose', readerState(this))
        this.socket?.unlisten(this.timelines, this.boundProcessEvent)
        this.socket?.removeOpenListener(this.boundCatchUp)
        this.onUpdate = undefined
        this.onNewItem = undefined
    }
}
