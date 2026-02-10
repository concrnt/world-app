import { Api } from './api'
import { RealtimeEvent } from './model'

// eslint-disable-next-line @typescript-eslint/no-require-imports
const WS = typeof window === 'undefined' ? require('ws') : window.WebSocket

export class Socket {
    api: Api
    ws: any
    subscriptions: Map<string, Set<(event: RealtimeEvent) => void>> = new Map()

    failcount = 0
    reconnecting = false

    hostOverride?: string

    constructor(api: Api, hostOverride?: string) {
        this.api = api
        this.hostOverride = hostOverride

        this.connect()
            .then(() => {
                setInterval(() => {
                    this.checkConnection()
                }, 1000)
                setInterval(() => {
                    this.heartbeat()
                }, 30000)
            })
            .catch((err) => {
                console.error('Failed to connect websocket:', err)
            })
    }

    async connect() {
        const host = this.hostOverride ?? this.api.defaultHost
        const server = await this.api.getServer(host)
        if (!server) {
            throw new Error(`Server not found for host: ${host}`)
        }

        const endpoint = server.endpoints['net.concrnt.core.realtime']

        if (!endpoint) {
            throw new Error(`Realtime endpoint not found for host: ${host}`)
        }

        this.ws = new WS('wss://' + (this.hostOverride ?? this.api.defaultHost) + endpoint.template)

        this.ws.onmessage = async (rawevent: any) => {
            const event: RealtimeEvent = JSON.parse(rawevent.data)

            // TODO: cache here
            // const document = JSON.parse(event.sd.document) as Document<any>

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
        this.ws.send(JSON.stringify({ type: 'h' }))
    }

    checkConnection() {
        if (this.ws.readyState !== WS.OPEN && !this.reconnecting) {
            this.failcount = 0
            this.reconnecting = true
            this.reconnect()
        }
    }

    reconnect() {
        if (this.ws.readyState === WS.OPEN) {
            console.info('reconnect confirmed')
            this.reconnecting = false
            this.failcount = 0
        } else {
            console.info('reconnecting. attempt: ', this.failcount)
            this.connect()
            this.failcount++
            setTimeout(
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
                console.log('distributing event for prefix:', prefix)
                callbacks.forEach((callback) => {
                    callback(event)
                })
            } else {
                console.log('not distributing event for prefix:', prefix)
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
        if (newtimelines.length > currenttimelines.length) {
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
        if (newtimelines.length < currenttimelines.length) {
            this.ws.send(JSON.stringify({ type: 'unlisten', prefixes: newtimelines }))
        }
    }

    ping() {
        this.ws.send(JSON.stringify({ type: 'h' }))
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
                } else if (this.ws.readyState === WS.OPEN) {
                    clearInterval(interval)
                    resolve(true)
                }
                currentAttempt++
            }, intervalTime)
        })
    }
}
