import { Api } from './api'
import { RealtimeEvent } from './model'
import { renderUriTemplate } from './util'

// eslint-disable-next-line @typescript-eslint/no-require-imports
const WS = typeof window === 'undefined' ? require('ws') : window.WebSocket

export class Socket {
    api: Api
    ws: any
    subscriptions: Map<string, Set<(event: RealtimeEvent) => void>> = new Map()
    // open(初回接続・再接続)のたびに呼ぶ。TimelineReaderが接続の隙間をcatch-upするために使う
    private openListeners: Set<() => void> = new Set()

    failcount = 0
    reconnecting = false

    hostOverride?: string

    private checkConnectionInterval?: ReturnType<typeof setInterval>
    private heartbeatInterval?: ReturnType<typeof setInterval>
    // ハートビート(購読リストの再送)に対する応答待ち。次のハートビートまでに何も届かなければ
    // 相手が消えた接続(half-open: readyStateはOPENのまま)とみなして張り直す
    private awaitingAck = false
    // 接続先が subscribed 応答を返すサーバーか。未対応サーバー(旧バージョン)では応答が無いのが
    // 正常なので、一度応答を見るまでは無応答を切断の根拠にしない
    private ackSupported = false
    private reconnectTimeout?: ReturnType<typeof setTimeout>
    private connectPromise: Promise<void> | null = null
    private disposed = false

    constructor(api: Api, hostOverride?: string) {
        this.api = api
        this.hostOverride = hostOverride

        // 初回接続に失敗しても監視は動かし続ける(checkConnectionが再接続を担う)
        this.checkConnectionInterval = setInterval(() => {
            this.checkConnection()
        }, 1000)
        this.heartbeatInterval = setInterval(() => {
            this.heartbeat()
        }, 30000)

        this.connect().catch((err) => {
            console.error('Failed to connect websocket:', err)
        })
    }

    connect(): Promise<void> {
        // 並行するconnectで複数のWebSocketが生成されないようシングルフライトにする
        if (this.connectPromise) return this.connectPromise
        this.connectPromise = this.doConnect().finally(() => {
            this.connectPromise = null
        })
        return this.connectPromise
    }

    private async doConnect() {
        if (this.disposed) return

        const host = this.hostOverride ?? this.api.defaultHost
        const server = await this.api.getServer(host)
        if (!server) {
            throw new Error(`Server not found for host: ${host}`)
        }

        const endpoint = renderUriTemplate(server, 'net.concrnt.core.realtime', {})

        this.ws?.close?.() // 古い接続が残っているとイベントが二重配信されるため閉じる
        this.ws = new WS('wss://' + (this.hostOverride ?? this.api.defaultHost) + endpoint)
        this.awaitingAck = false
        this.ackSupported = false

        this.ws.onmessage = async (rawevent: any) => {
            // 何か届いた=接続は生きている(イベントでも応答でもよい)
            this.awaitingAck = false
            const event: RealtimeEvent = JSON.parse(rawevent.data)

            if (event.type === 'subscribed') {
                // listenの応答。サーバーが実際に購読しているリストが返る
                this.ackSupported = true
                const prefixes: string[] = (event as any).prefixes ?? []
                const missing = Array.from(this.subscriptions.keys()).filter((p) => !prefixes.includes(p))
                if (missing.length > 0) {
                    console.info('socket subscribed without:', missing)
                }
                return
            }

            switch (event.type) {
                case 'created': {
                    // TODO: cache here
                    // const document = JSON.parse(event.sd.document) as Document<any>
                    break
                }
                case 'associated': {
                    this.api.notifyResourceUpdate(event.uri)
                    break
                }
                case 'unassociated': {
                    this.api.notifyResourceUpdate(event.uri)
                    break
                }
                case 'deleted': {
                    this.api.notifyResourceUpdate(event.uri)
                    break
                }
            }

            this.distribute(event.source, event)
        }

        this.ws.onerror = (event: any) => {
            console.info('socket error', event)
        }

        this.ws.onclose = (event: any) => {
            console.info('socket close', event)
        }

        this.ws.onopen = (event: any) => {
            console.info('socket open', event)
            this.ws.send(JSON.stringify({ type: 'listen', prefixes: Array.from(this.subscriptions.keys()) }))
            for (const listener of Array.from(this.openListeners)) {
                listener()
            }
        }
    }

    get isOpen(): boolean {
        return this.ws?.readyState === WS.OPEN
    }

    addOpenListener(listener: () => void) {
        this.openListeners.add(listener)
    }

    removeOpenListener(listener: () => void) {
        this.openListeners.delete(listener)
    }

    // 購読リストをそのまま再送する(listenは全置換なので何度送ってもよい)。サーバーは実際に
    // 購読しているリストを subscribed で返すので、これを生存確認を兼ねたハートビートにする。
    // 前回の送信に何の応答も無いまま次の周期が来たら、ブラウザが気付けない切断とみなして張り直す
    heartbeat() {
        if (this.ws?.readyState !== WS.OPEN) return
        if (this.ackSupported && this.awaitingAck) {
            console.info('socket heartbeat unanswered. reconnecting')
            this.discard()
            this.reconnectNow()
            return
        }
        this.awaitingAck = true
        this.ws.send(JSON.stringify({ type: 'listen', prefixes: Array.from(this.subscriptions.keys()) }))
    }

    // 死んだとみなした接続を手放す。closeハンドシェイクは相手が居ないと完了しないので待たず、
    // 以後のイベント(遅れて届いたcloseなど)も受け取らない
    private discard() {
        const ws = this.ws
        if (!ws) return
        ws.onmessage = null
        ws.onerror = null
        ws.onclose = null
        ws.onopen = null
        this.ws = undefined
        this.awaitingAck = false
        this.ackSupported = false
        try {
            ws.close()
        } catch (e) {
            console.info('socket close failed', e)
        }
    }

    checkConnection() {
        // 接続処理が進行中の間は再接続を起動しない
        if (this.connectPromise || this.ws?.readyState === WS.CONNECTING) return
        if (this.ws?.readyState !== WS.OPEN && !this.reconnecting) {
            this.failcount = 0
            this.reconnecting = true
            this.reconnect()
        }
    }

    // ホストのオンライン復帰時に呼ぶ。独自バックオフ(最大約220秒)の待機を打ち切って即再接続する
    reconnectNow() {
        if (this.disposed || this.isOpen) return
        if (this.reconnectTimeout) clearTimeout(this.reconnectTimeout)
        this.failcount = 0
        this.reconnecting = true
        this.reconnect()
    }

    reconnect() {
        if (this.disposed) return
        if (this.ws?.readyState === WS.OPEN) {
            console.info('reconnect confirmed')
            this.reconnecting = false
            this.failcount = 0
        } else {
            console.info('reconnecting. attempt: ', this.failcount)
            this.connect().catch((err) => {
                console.info('reconnect attempt failed:', err)
            })
            this.failcount++
            this.reconnectTimeout = setTimeout(
                () => {
                    this.reconnect()
                },
                500 * Math.pow(1.5, Math.min(this.failcount, 15))
            )
        }
    }

    distribute(uri: string, event: RealtimeEvent) {
        for (const [prefix, callbacks] of this.subscriptions.entries()) {
            if (uri.startsWith(prefix)) {
                callbacks.forEach((callback) => {
                    callback(event)
                })
            }
        }
    }

    listen(prefixes: string[], callback: (event: RealtimeEvent) => void) {
        const currenttimelines = Array.from(this.subscriptions.keys())
        prefixes.forEach((topic) => {
            if (!this.subscriptions.has(topic)) {
                this.subscriptions.set(topic, new Set())
            }
            this.subscriptions.get(topic)?.add(callback)
        })
        const newtimelines = Array.from(this.subscriptions.keys())
        // 未接続時はonopenが購読リストを再送するので送信をスキップして良い
        if (newtimelines.length > currenttimelines.length && this.ws?.readyState === WS.OPEN) {
            this.ws.send(JSON.stringify({ type: 'listen', prefixes: newtimelines }))
        }
    }

    unlisten(prefixes: string[], callback: (event: RealtimeEvent) => void) {
        const currenttimelines = Array.from(this.subscriptions.keys())
        prefixes.forEach((topic) => {
            if (this.subscriptions.has(topic)) {
                this.subscriptions.get(topic)?.delete(callback)

                if (this.subscriptions.get(topic)?.size === 0) {
                    this.subscriptions.delete(topic)
                }
            }
        })
        const newtimelines = Array.from(this.subscriptions.keys())
        // 購読解除は縮小したリストでlistenを送り直す(全置換。unlistenという種別は無い)
        if (newtimelines.length < currenttimelines.length && this.ws?.readyState === WS.OPEN) {
            this.ws.send(JSON.stringify({ type: 'listen', prefixes: newtimelines }))
        }
    }

    ping() {
        this.heartbeat()
    }

    dispose() {
        this.disposed = true
        if (this.checkConnectionInterval) clearInterval(this.checkConnectionInterval)
        if (this.heartbeatInterval) clearInterval(this.heartbeatInterval)
        if (this.reconnectTimeout) clearTimeout(this.reconnectTimeout)
        this.ws?.close?.()
    }

    waitOpen() {
        return new Promise((resolve, reject) => {
            const maxNumberOfAttempts = 10
            const intervalTime = 200 //ms

            let currentAttempt = 0
            const interval = setInterval(() => {
                if (currentAttempt > maxNumberOfAttempts - 1) {
                    clearInterval(interval)
                    reject(new Error('Maximum number of attempts exceeded'))
                } else if (this.ws?.readyState === WS.OPEN) {
                    clearInterval(interval)
                    resolve(true)
                }
                currentAttempt++
            }, intervalTime)
        })
    }
}
