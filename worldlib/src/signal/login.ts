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
    // 受信側が付けたいサブキーの表示名(任意・world-app 独自の value.name)。送信側は検証してから enact に入れる
    name?: string
}

// 受信した name として受け付ける上限。これを超える/空/文字列でないものは無視する
const SUBKEY_NAME_MAX_LENGTH = 64

const normalizeSubkeyName = (value: unknown): string | undefined => {
    if (typeof value !== 'string') return undefined
    const trimmed = value.trim()
    if (trimmed.length === 0 || trimmed.length > SUBKEY_NAME_MAX_LENGTH) return undefined
    return trimmed
}

export interface SignalLoginReceiverOptions {
    // signature_request を送るたびに呼ばれ、空でなければ name として同梱する(入力途中でも最新値が乗る)
    keyName?: () => string | undefined
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
        completionCallback: (keyURI: string) => void,
        options?: SignalLoginReceiverOptions
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
                            keyGenerationCallback(data.ccid, data.domain)
                                .then((ckid) => {
                                    this.ckid = ckid
                                })
                                .catch((err) => {
                                    console.error('Key generation failed:', err)
                                    // tickerがinit_requestを再送するので、initを空に戻せば再試行できる
                                    this.init = null
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
                    const name = normalizeSubkeyName(options?.keyName?.())
                    if (name) request.name = name
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
        keyCreationCallback: (ckid: string, name?: string) => Promise<string>,
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
                            keyCreationCallback(ckid, normalizeSubkeyName(data.name))
                                .then((keyURI) => {
                                    this.keyURI = keyURI
                                    const response: SignalLoginSignatureResponse = {
                                        type: 'signal_login_signature_response',
                                        keyURI: keyURI
                                    }
                                    ws.send(JSON.stringify(response))
                                })
                                .catch((err) => {
                                    console.error('Key creation failed:', err)
                                    // キャンセル時に立てっぱなしだと次のsignature_requestで再確認できない
                                    this.generatingKey = false
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
