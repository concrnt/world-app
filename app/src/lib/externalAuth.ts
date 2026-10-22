// CIP-17 (Sign-In with Concrnt) の Authenticator 側の処理。UI は持たない。
//
//   1. QR の文字列 (Authorization Request URI) を検証する      parseAuthorizationRequestUri
//   2. request_uri から Request Object を取得して検証する       fetchRequestObject
//   3. (同意画面で承認されたら) master key で ID Token に署名する buildIdToken
//   4. client_id に direct_post する                            postResponse
import type { Client } from '@concrnt/worldlib'

export const AUTH_URI_SCHEME = 'concrnt-auth://'

// ID Token の有効期間 (秒)。ログイン操作の証明なので短命にする (§7.2 は iat から 10 分以内を推奨)
const ID_TOKEN_LIFETIME = 300

export interface AuthorizationRequestUri {
    clientId: string
    requestUri: string
}

// §5.3 Request Object
export interface RequestObject {
    client_id: string
    response_type: string
    response_mode: string
    scope: string
    nonce: string
    state?: string
    exp: number
    display_code?: string
    client_metadata?: {
        client_name?: string
        logo_uri?: string
        policy_uri?: string
        tos_uri?: string
    }
}

export type ExternalAuthErrorCode =
    | 'invalidUri'
    | 'originMismatch'
    | 'fetchFailed'
    | 'invalidRequest'
    | 'expired'
    | 'unsupportedMode'
    | 'signFailed'
    | 'postFailed'

export class ExternalAuthError extends Error {
    constructor(public readonly code: ExternalAuthErrorCode) {
        super(code)
    }
}

// §5.1 / §5.2 / §5.4-1: Authorization Request URI の検証
export const parseAuthorizationRequestUri = (text: string): AuthorizationRequestUri => {
    if (!text.startsWith(AUTH_URI_SCHEME)) throw new ExternalAuthError('invalidUri')
    const query = text.slice(AUTH_URI_SCHEME.length)
    if (!query.startsWith('?')) throw new ExternalAuthError('invalidUri')

    // §5.2: パラメータは client_id と request_uri の 2 つだけ (重複も不可)
    const params = new URLSearchParams(query)
    const clientId = params.get('client_id')
    const requestUri = params.get('request_uri')
    if (!clientId || !requestUri || [...params.keys()].length !== 2) throw new ExternalAuthError('invalidUri')

    // §5.1: https の絶対 URL でフラグメント無し
    const clientUrl = parseHttpsUrl(clientId)
    const requestUrl = parseHttpsUrl(requestUri)
    if (!clientUrl || !requestUrl) throw new ExternalAuthError('invalidUri')

    // §5.2: request_uri のオリジンは client_id のオリジンと一致しなければならない
    if (clientUrl.origin !== requestUrl.origin) throw new ExternalAuthError('originMismatch')

    return { clientId, requestUri }
}

const parseHttpsUrl = (text: string): URL | null => {
    try {
        const url = new URL(text)
        if (url.protocol !== 'https:' || text.includes('#')) return null
        return url
    } catch {
        return null
    }
}

// §5.3 / §5.4-2〜5: Request Object の取得と検証。
// 失敗したら throw するだけで、RP には何も送らない (§5.4, §8.3)
export const fetchRequestObject = async (uri: AuthorizationRequestUri): Promise<RequestObject> => {
    let res: Response
    try {
        // §5.4-2: リダイレクトに追従しない。redirect: 'manual' のリダイレクトは status 0 の
        // opaqueredirect になるので、ok でないものを一律に失敗扱いにすればよい
        res = await fetch(uri.requestUri, { redirect: 'manual' })
    } catch {
        throw new ExternalAuthError('fetchFailed')
    }
    if (!res.ok) throw new ExternalAuthError('fetchFailed')

    let request: RequestObject
    try {
        request = await res.json()
    } catch {
        throw new ExternalAuthError('invalidRequest')
    }

    // §5.4-3: client_id が URI のものと一致する
    if (request.client_id !== uri.clientId) throw new ExternalAuthError('invalidRequest')

    // §5.4-4,5: 必須パラメータの型と値
    if (request.response_type !== 'id_token') throw new ExternalAuthError('invalidRequest')
    if (typeof request.nonce !== 'string' || request.nonce === '') throw new ExternalAuthError('invalidRequest')
    if (typeof request.scope !== 'string' || !request.scope.split(' ').includes('openid')) {
        throw new ExternalAuthError('invalidRequest')
    }
    if (typeof request.exp !== 'number') throw new ExternalAuthError('invalidRequest')
    if (request.exp <= Math.floor(Date.now() / 1000)) throw new ExternalAuthError('expired')

    // 同一端末フロー (fragment, §8.2) は未対応。QR 経由の cross-device (direct_post) のみ扱う
    if (request.response_mode === 'fragment') throw new ExternalAuthError('unsupportedMode')
    if (request.response_mode !== 'direct_post') throw new ExternalAuthError('invalidRequest')

    return request
}

// §7: ID Token を組み立てて master key で署名する。
// CIP-2 の auth token と違い iat/exp は数値で、nonce やプロフィールのクレームが入るため
// client.api.signJWT は使わず、ここで組み立てる
export const buildIdToken = async (client: Client, request: RequestObject): Promise<string> => {
    const now = Math.floor(Date.now() / 1000)

    // §7.2
    const claims: Record<string, string | number> = {
        iss: client.ccid,
        sub: client.ccid,
        aud: request.client_id,
        nonce: request.nonce,
        iat: now,
        exp: now + ID_TOKEN_LIFETIME,
        jti: crypto.randomUUID(),
        concrnt_domain: client.server.domain
    }

    // §7.3: scope に profile があるときだけ、現在のプロフィールから自己申告で付ける
    if (request.scope.split(' ').includes('profile')) {
        if (client.profile.username) claims.name = client.profile.username
        if (client.profile.avatar) claims.picture = client.profile.avatar
        claims.profile =
            `https://concrnt.world/profile/${client.ccid}` +
            (client.currentProfile !== 'main' ? `/${client.currentProfile}` : '')
        if (client.entity.alias) claims.preferred_username = client.entity.alias
        const updatedAt = client.profileDocument?.createdAt
        if (updatedAt) claims.updated_at = Math.floor(new Date(updatedAt).getTime() / 1000)
    }

    // §7.1: kid 無し = エンティティ本体の鍵 (master key) で署名
    const header = { alg: 'CONCRNT', typ: 'JWT' }
    const signingInput = base64url(utf8(JSON.stringify(header))) + '.' + base64url(utf8(JSON.stringify(claims)))

    // 署名は hex の r(32) || s(32) || v(1)。この呼び出しで端末の生体認証 / PIN が出る
    let hex: string
    try {
        hex = await client.api.authProvider.signMaster(signingInput)
    } catch {
        throw new ExternalAuthError('signFailed')
    }
    if (!/^[0-9a-f]{130}$/i.test(hex)) throw new ExternalAuthError('signFailed')
    const signature = Uint8Array.from(hex.match(/../g)!, (byte) => parseInt(byte, 16))

    return signingInput + '.' + base64url(signature)
}

// §8.1 direct_post / §8.3 エラー応答: client_id へ form-urlencoded で POST する
export const postResponse = async (clientId: string, params: Record<string, string>): Promise<void> => {
    let res: Response
    try {
        // §8.1: この POST でもリダイレクトに追従しない
        res = await fetch(clientId, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams(params).toString(),
            redirect: 'manual'
        })
    } catch {
        throw new ExternalAuthError('postFailed')
    }
    if (!res.ok) throw new ExternalAuthError('postFailed')
}

const utf8 = (text: string): Uint8Array => new TextEncoder().encode(text)

// パディング無し base64url (CIP-2 §4)。btoa は Latin-1 しか受けないのでバイト列経由で変換する
const base64url = (bytes: Uint8Array): string =>
    btoa(String.fromCharCode(...bytes))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '')
