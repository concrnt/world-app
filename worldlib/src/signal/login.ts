import { IsCCID, ValidateSignature } from '@concrnt/client'

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

// 登録モード(web の「このサーバーに登録する」)の受信側が init_request の代わりに送る。
// アカウントの無いアプリは entity 文書に署名して signal_register_init_response を返し、
// アカウントのあるアプリは確認のうえ signal_login_init_response を返して通常のログインに合流する
export interface SignalRegisterInitRequest {
    type: 'signal_register_init_request'
    domain: string
}

export interface SignalRegisterInitResponse {
    type: 'signal_register_init_response'
    ccid: string
    domain: string
    entity: {
        document: string
        proof: { type: 'concrnt-ecrecover-direct'; signature: string }
    }
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

const SIGNATURE_PATTERN = /^[0-9a-f]{130}$/i
const DOMAIN_PATTERN = /^[a-z0-9.-]+(:\d+)?$/i

// signal_register_init_response の形と署名を検証する。合格した文書だけを呼び出し側に渡す。
// JSON.parse や ValidateSignature が throw する入力(壊れた JSON・不正な hex)はそのまま
// onmessage から抜けるだけで受信側の状態は変わらないので、ここでは捕まえない
const isValidRegisterInitResponse = (data: any, domain: string): data is SignalRegisterInitResponse => {
    if (typeof data?.ccid !== 'string' || !IsCCID(data.ccid)) return false
    if (data.domain !== domain) return false
    const entity = data.entity
    if (typeof entity?.document !== 'string') return false
    if (entity.proof?.type !== 'concrnt-ecrecover-direct') return false
    if (typeof entity.proof.signature !== 'string' || !SIGNATURE_PATTERN.test(entity.proof.signature)) return false
    if (!ValidateSignature(entity.document, entity.proof.signature, data.ccid)) return false
    const doc = JSON.parse(entity.document)
    if (doc?.kind !== 'entity' || doc.author !== data.ccid) return false
    if (doc.schema !== 'https://schema.concrnt.net/entity.json') return false
    if (doc.value?.domain !== domain) return false
    return true
}

export interface SignalLoginReceiverOptions {
    // signature_request を送るたびに呼ばれ、空でなければ name として同梱する(入力途中でも最新値が乗る)
    keyName?: () => string | undefined
    // 指定すると登録モード: init_request の代わりに signal_register_init_request{domain} を送る
    registration?: {
        domain: string
        // 検証済みの entity 文書。resolve するまで ticker は何も送らず、resolve 後に
        // keyGenerationCallback(ccid, domain) から通常のログイン手順に合流する(reject は呼び出し側の責務)
        onRegister: (ccid: string, entity: SignalRegisterInitResponse['entity']) => Promise<void>
        // 登録 QR をアカウント持ちのアプリが読み、既存アカウントでのログインに切り替わったとき(一度だけ)
        onLoginFallback?: () => void
    }
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
    registration: SignalRegisterInitResponse | null = null
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
                        // 登録を受理した後に別の端末がログインで応答しても無視する
                        if (this.registration) break
                        if (!this.init) {
                            this.init = data
                            options?.registration?.onLoginFallback?.()
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
                case 'signal_register_init_response':
                    {
                        const registration = options?.registration
                        if (!registration || this.init || this.registration) break
                        if (!isValidRegisterInitResponse(data, registration.domain)) {
                            console.warn('Ignoring invalid register init response')
                            break
                        }
                        this.registration = data
                        registration
                            .onRegister(data.ccid, data.entity)
                            .then(() => {
                                // 登録済み。以降は通常のログインと同じ(サブキー生成 → signature_request)
                                this.init = { type: 'signal_login_init_response', ccid: data.ccid, domain: data.domain }
                                return keyGenerationCallback(data.ccid, data.domain)
                            })
                            .then((ckid) => {
                                this.ckid = ckid
                            })
                            .catch((err) => {
                                console.error('Registration failed:', err)
                                this.init = null
                                this.registration = null
                            })
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
                // 登録要求を受理して web 側が登録処理中の間は何も送らない(アプリが応答を再送し続けるのを避ける)
                if (this.registration) return
                if (options?.registration) {
                    const request: SignalRegisterInitRequest = {
                        type: 'signal_register_init_request',
                        domain: options.registration.domain
                    }
                    ws.send(JSON.stringify(request))
                } else {
                    const request: SignalLoginInitRequest = {
                        type: 'signal_login_init_request'
                    }
                    ws.send(JSON.stringify(request))
                }
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

export interface SignalLoginSenderOptions {
    // 登録 QR(signal_register_init_request)を読んだとき、既存アカウントでログインするかを一度だけ確認する。
    // true なら init_response を返して通常のログインに合流、false なら以後この要求を無視する。未指定なら無視
    onRegisterRequest?: (domain: string) => Promise<boolean>
}

export class SignalLoginSender {
    generatingKey: boolean = false
    keyURI: string | null = null
    registerPrompting: boolean = false
    registerDecision: boolean | null = null
    ws: WebSocket | null = null

    constructor(
        channelURL: string,
        ccid: string,
        domain: string,
        keyCreationCallback: (ckid: string, name?: string) => Promise<string>,
        onCompleted: () => void,
        options?: SignalLoginSenderOptions
    ) {
        const ws = new WS(channelURL)
        this.ws = ws

        ws.onopen = () => {
            console.log('WebSocket connection opened')
        }

        const sendInitResponse = () => {
            const init: SignalLoginInitResponse = {
                type: 'signal_login_init_response',
                ccid: ccid,
                domain: domain
            }
            ws.send(JSON.stringify(init))
        }

        ws.onmessage = (event: any) => {
            console.log('Received message:', event.data)
            const data = JSON.parse(event.data)
            switch (data.type) {
                case 'signal_login_init_request':
                    {
                        sendInitResponse()
                    }
                    break
                case 'signal_register_init_request':
                    {
                        if (typeof data.domain !== 'string') return
                        if (this.registerDecision === true) {
                            sendInitResponse()
                            return
                        }
                        if (this.registerDecision === false || this.registerPrompting) return
                        if (!options?.onRegisterRequest) return
                        this.registerPrompting = true
                        options
                            .onRegisterRequest(data.domain)
                            .then((ok) => {
                                this.registerDecision = ok
                                if (ok) sendInitResponse()
                            })
                            .finally(() => {
                                this.registerPrompting = false
                            })
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

export interface SignalRegisterSenderCallbacks {
    // web から登録先 domain が届いたら呼ばれる。ユーザーの同意のうえでマスターキーを作り entity 文書に署名して返す。
    // null は拒否(以後この要求を無視する)
    onRegisterRequest: (domain: string) => Promise<SignalRegisterInitResponse | null>
    // 登録後に web が自分用に作ったサブキーの enact(SignalLoginSender と同じ契約・keyURI を返す)
    keyCreationCallback: (ckid: string, name?: string) => Promise<string>
    // 読んだ QR が登録用ではなく既存アカウントのログイン用だったとき(一度だけ)
    onLoginRequest?: () => void
    onCompleted: () => void
}

// アカウントの無いアプリ側。登録 QR のチャンネルに接続し、entity 文書の署名と web 用サブキーの enact を行う
export class SignalRegisterSender {
    response: SignalRegisterInitResponse | null = null
    prompting: boolean = false
    declined: boolean = false
    loginRequested: boolean = false
    generatingKey: boolean = false
    keyURI: string | null = null
    completed: boolean = false
    ws: WebSocket | null = null

    constructor(channelURL: string, callbacks: SignalRegisterSenderCallbacks) {
        const ws = new WS(channelURL)
        this.ws = ws

        ws.onopen = () => {
            console.log('WebSocket connection opened')
        }

        ws.onmessage = (event: any) => {
            console.log('Received message:', event.data)
            const data = JSON.parse(event.data)
            switch (data.type) {
                case 'signal_register_init_request':
                    {
                        if (typeof data.domain !== 'string' || !DOMAIN_PATTERN.test(data.domain)) return
                        if (this.response) {
                            ws.send(JSON.stringify(this.response))
                            return
                        }
                        if (this.prompting || this.declined) return
                        this.prompting = true
                        callbacks
                            .onRegisterRequest(data.domain)
                            .then((response) => {
                                if (!response) {
                                    this.declined = true
                                    return
                                }
                                this.response = response
                                ws.send(JSON.stringify(response))
                            })
                            .finally(() => {
                                this.prompting = false
                            })
                    }
                    break
                case 'signal_login_init_request':
                    {
                        if (this.loginRequested) return
                        this.loginRequested = true
                        callbacks.onLoginRequest?.()
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
                            callbacks
                                .keyCreationCallback(ckid, normalizeSubkeyName(data.name))
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
                                    this.generatingKey = false
                                })
                            this.generatingKey = true
                        }
                    }
                    break
                case 'signal_login_completion_request':
                    {
                        if (this.completed) return
                        this.completed = true
                        callbacks.onCompleted()
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
