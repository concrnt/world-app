// eslint-disable-next-line @typescript-eslint/no-require-imports
const WS = typeof window === 'undefined' ? require('ws') : window.WebSocket

export interface SignalLoginInitRequest {
    type: 'signal_login_init_request'
}

export interface SignalLoginInitResponse {
    type: 'signal_login_init_response'
    ccid: string
    domain: string
}

export interface SignalLoginSignatureRequest {
    type: 'signal_login_signature_request'
    ckid: string
}

export interface SignalLoginSignatureResponse {
    type: 'signal_login_signature_response'
    keyURI: string
}

export interface SignalLoginCompletionRequest {
    type: 'signal_login_completion_request'
}

export class SignalLoginReceiver {
    init: SignalLoginInitResponse | null = null
    ckid: string | null = null

    ws: WebSocket | null = null
    ticker: NodeJS.Timeout | null = null

    constructor(
        channelURL: string,
        keyGenerationCallback: (ccid: string, domain: string) => Promise<string>,
        completionCallback: (keyURI: string) => void
    ) {
        const ws = new WS(channelURL)
        this.ws = ws

        ws.onopen = () => {
            console.log('WebSocket connection opened')
        }

        ws.onmessage = (event: any) => {
            console.log('Received message:', event.data)
            const data = JSON.parse(event.data)
            switch (data.type) {
                case 'signal_login_init_response':
                    {
                        if (!this.init) {
                            this.init = data
                            keyGenerationCallback(data.ccid, data.domain).then((ckid) => {
                                this.ckid = ckid
                            })
                        }
                    }
                    break
                case 'signal_login_signature_response':
                    {
                        completionCallback(data.keyURI)

                        ws.send(
                            JSON.stringify({
                                type: 'signal_login_completion_request'
                            })
                        )

                        if (this.ticker) {
                            clearInterval(this.ticker)
                        }
                    }
                    break
                default:
                    console.warn('Unknown message type:', data.type)
            }
        }

        this.ticker = setInterval(() => {
            if (!this.init) {
                const request: SignalLoginInitRequest = {
                    type: 'signal_login_init_request'
                }
                ws.send(JSON.stringify(request))
            } else {
                if (this.ckid) {
                    const request: SignalLoginSignatureRequest = {
                        type: 'signal_login_signature_request',
                        ckid: this.ckid
                    }
                    ws.send(JSON.stringify(request))
                }
            }
        }, 1000)
    }

    dispose() {
        if (this.ticker) {
            clearInterval(this.ticker)
        }
        if (this.ws) {
            this.ws.close()
        }
    }
}

export class SignalLoginSender {
    generatingKey: boolean = false
    keyURI: string | null = null
    ws: WebSocket | null = null

    constructor(
        channelURL: string,
        ccid: string,
        domain: string,
        keyCreationCallback: (ckid: string) => Promise<string>,
        onCompleted: () => void
    ) {
        const ws = new WS(channelURL)
        this.ws = ws

        ws.onopen = () => {
            console.log('WebSocket connection opened')
        }

        ws.onmessage = (event: any) => {
            console.log('Received message:', event.data)
            const data = JSON.parse(event.data)
            switch (data.type) {
                case 'signal_login_init_request':
                    {
                        const init = {
                            type: 'signal_login_init_response',
                            ccid: ccid,
                            domain: domain
                        }
                        ws.send(JSON.stringify(init))
                    }
                    break
                case 'signal_login_signature_request':
                    {
                        if (this.keyURI) {
                            const response: SignalLoginSignatureResponse = {
                                type: 'signal_login_signature_response',
                                keyURI: this.keyURI
                            }
                            ws.send(JSON.stringify(response))
                        } else {
                            if (this.generatingKey) return
                            const ckid = data.ckid
                            if (!ckid) return
                            keyCreationCallback(ckid).then((keyURI) => {
                                this.keyURI = keyURI
                                const response: SignalLoginSignatureResponse = {
                                    type: 'signal_login_signature_response',
                                    keyURI: keyURI
                                }
                                ws.send(JSON.stringify(response))
                            })
                            this.generatingKey = true
                        }
                    }
                    break
                case 'signal_login_completion_request':
                    {
                        onCompleted()
                    }
                    break
                default:
                    console.warn('Unknown message type:', data.type)
            }
        }
    }

    dispose() {
        if (this.ws) {
            this.ws.close()
        }
    }
}
