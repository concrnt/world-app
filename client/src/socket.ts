import { Api } from './api'
import { RealtimeEvent } from './model'
import { renderUriTemplate } from './util'

// eslint-disable-next-line @typescript-eslint/no-require-imports
const WS = typeof window === 'undefined' ? require('ws') : window.WebSocket

export class Socket {
    api: Api
    ws: any
    subscriptions: Map<string, Set<(event: RealtimeEvent) => void>> = new Map()

    failcount = 0
    reconnecting = false

    hostOverride?: string

    private checkConnectionInterval?: ReturnType<typeof setInterval>
    private heartbeatInterval?: ReturnType<typeof setInterval>
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

        this.ws.onmessage = async (rawevent: any) => {
            const event: RealtimeEvent = JSON.parse(rawevent.data)

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
        }
    }

    heartbeat() {
        if (this.ws?.readyState !== WS.OPEN) return
        this.ws.send(JSON.stringify({ type: 'h' }))
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
        if (newtimelines.length < currenttimelines.length && this.ws?.readyState === WS.OPEN) {
            this.ws.send(JSON.stringify({ type: 'unlisten', prefixes: newtimelines }))
        }
    }

    ping() {
        if (this.ws?.readyState !== WS.OPEN) return
        this.ws.send(JSON.stringify({ type: 'h' }))
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
