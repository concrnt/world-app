import type { Socket } from './socket'
import type { TimelineReader } from './timelineReader'

// 新着が止まってからDevToolsを開いてもWebSocketの通信は遡れないので、リアルタイム経路
// (Socketの接続 → サーバーの応答 → 購読への振り分け → TimelineReader → 描画)の状態と
// 直近の異常をメモリに持っておき、症状が出た後に取り出せるようにする

interface RealtimeLogEntry {
    at: string
    event: string
    detail?: unknown
}

const LOG_LIMIT = 300
const log: RealtimeLogEntry[] = []

export const liveSockets = new Set<Socket>()
export const liveReaders = new Set<TimelineReader>()

export const recordRealtime = (event: string, detail?: unknown) => {
    log.push({ at: new Date().toISOString(), event, detail })
    if (log.length > LOG_LIMIT) log.shift()
}

// 画面遷移(Dev画面を開く等)でreaderはdisposeされて一覧から消えるので、dispose時にもこの状態をlogへ残す
export const readerState = (reader: TimelineReader) => ({
    timelines: reader.timelines,
    hostOverride: reader.hostOverride,
    withSocket: reader.socket !== undefined,
    headLoaded: reader.headLoaded,
    haltUpdate: reader.haltUpdate,
    pendingEvents: reader.pendingEvents?.length ?? null,
    bodyLength: reader.body.length,
    ...reader.stats
})

export const realtimeDiagnostics = () => ({
    now: new Date().toISOString(),
    sockets: Array.from(liveSockets, (socket) => ({
        host: socket.hostOverride ?? socket.api.defaultHost,
        readyState: socket.ws?.readyState,
        reconnecting: socket.reconnecting,
        failcount: socket.failcount,
        awaitingAck: socket.awaitingAck,
        ackSupported: socket.ackSupported,
        subscriptions: Object.fromEntries(
            Array.from(socket.subscriptions, ([prefix, callbacks]) => [prefix, callbacks.size])
        ),
        ...socket.stats
    })),
    readers: Array.from(liveReaders, readerState),
    log: [...log]
})
