// CIP-17 (Sign-In with Concrnt) の Authenticator 側の処理。UI は持たない。
//
//   1. Authorization Request URI (QR / deep link の文字列) を検証する  parseAuthorizationRequestUri
//      要求の内容はすべて URI に載っている (by-value)。RP に何かを取りに行くことは無い
//   2. (同意画面で承認されたら) master key で ID Token に署名する       buildIdToken
//   3. 応答を返す: 送り先 URL に POST する (§8.1)                      postResponse
//              または 送り先 URL#… をブラウザで開く (§8.2)             openFragmentResponse
import type { Client } from '@concrnt/worldlib'
import { openUrl } from '@tauri-apps/plugin-opener'

export const AUTH_URI_SCHEME = 'concrnt-auth://'

// ID Token の有効期間 (秒)。§7.2: exp = iat + 300 に固定
const ID_TOKEN_LIFETIME = 300

// 応答の配送方法 (§8)。Authorization Request URI の <type> で決まり、開き方 (アプリ内スキャナーか
// deep link か) には依存しない。OS のカメラで読んだ QR は deep link として届くので、開き方では区別できない。
//   post (§8.1):     別端末の画面にログインする。同意画面で display_code の照合を出す
//   fragment (§8.2): この端末のブラウザに戻る
export type ResponseMode = 'post' | 'fragment'

// §5.2: concrnt-auth://<type>/<host>/<path>?n=<nonce>[&s=<scope>]
// concrnt-auth://signal/… (他の端末のログイン) は CIP-17 ではなく lib/signalLogin.ts が先に拾う
export interface AuthorizationRequestUri {
    responseMode: ResponseMode
    /** RP の身元としてユーザーに見せる host (§6) */
    host: string
    /** 応答の送り先 https://<host>/<path> (§5.1)。host が localhost / 127.0.0.1 のときだけ http (§5.2 MAY) */
    redirectUri: string
    /** ID Token の aud (§7.2)。常に "https://" + <host>/<path> で、正規化しない */
    audience: string
    /** n。ID Token の nonce になり、RP が要求を引くキー */
    nonce: string
    /** s をスペースで分けたもの。省略時は ['profile']、`s=` なら []。未知の値はそのまま入る (無視する) */
    scope: string[]
}

export type ExternalAuthErrorCode = 'invalidUri' | 'invalidRequest' | 'signFailed' | 'postFailed'

export class ExternalAuthError extends Error {
    constructor(public readonly code: ExternalAuthErrorCode) {
        super(code)
    }
}

// §5.2 / §5.3: Authorization Request URI の構文と制約。
// 失敗したら throw するだけで、RP には何も送らない (§5.3, §8.3)
export const parseAuthorizationRequestUri = (text: string): AuthorizationRequestUri => {
    if (!text.startsWith(AUTH_URI_SCHEME)) throw new ExternalAuthError('invalidUri')
    if (text.includes('#')) throw new ExternalAuthError('invalidUri')
    const rest = text.slice(AUTH_URI_SCHEME.length)
    const slash = rest.indexOf('/')
    if (slash <= 0) throw new ExternalAuthError('invalidUri')
    // §5.2: <type> は post / fragment のみ。未知の値は拒否する (MUST)
    const responseMode = rest.slice(0, slash)
    if (responseMode !== 'post' && responseMode !== 'fragment') throw new ExternalAuthError('invalidUri')

    const afterMode = rest.slice(slash + 1)
    const query = afterMode.indexOf('?')
    if (query < 0) throw new ExternalAuthError('invalidUri') // n は必須なのでクエリは必ずある
    const hostAndPath = afterMode.slice(0, query)
    const params = new URLSearchParams(afterMode.slice(query + 1))

    // <host> は userinfo を含まない (MUST NOT)、<path> は空でない (MUST NOT)
    const pathStart = hostAndPath.indexOf('/')
    if (pathStart <= 0 || /[@\\?#\s]/.test(hostAndPath.slice(0, pathStart))) throw new ExternalAuthError('invalidUri')
    const target = parseHttpsUrl('https://' + hostAndPath)
    if (!target || target.pathname === '/' || target.host !== hostAndPath.slice(0, pathStart)) {
        throw new ExternalAuthError('invalidUri')
    }

    // n: 16 バイト以上の乱数の base64url (22 文字以上)
    const nonce = params.get('n')
    if (!nonce || !/^[A-Za-z0-9_-]{22,}$/.test(nonce)) throw new ExternalAuthError('invalidUri')

    // s: 省略 = profile、空 = CCID のみ。未知のクエリパラメータは無視する (MUST)
    const s = params.get('s')
    const scope = s === null ? ['profile'] : s.split(' ').filter((v) => v !== '')

    // 送り先: ローカル開発用に localhost だけ http で送ってよい (MAY)。識別子 (aud) は常に https 表記
    const audience = 'https://' + hostAndPath
    const isLocalhost = target.hostname === 'localhost' || target.hostname === '127.0.0.1'
    const redirectUri = (isLocalhost ? 'http://' : 'https://') + hostAndPath

    return { responseMode, host: target.host, redirectUri, audience, nonce, scope }
}

const parseHttpsUrl = (text: string): URL | null => {
    try {
        const url = new URL(text)
        if (url.protocol !== 'https:' || url.username || url.password) return null
        return url
    } catch {
        return null
    }
}

// §7: ID Token を組み立てて master key で署名する。
// CIP-2 の auth token と違い iat/exp は数値で、nonce やプロフィールのクレームが入るため
// client.api.signJWT は使わず、ここで組み立てる
export const buildIdToken = async (client: Client, uri: AuthorizationRequestUri): Promise<string> => {
    const now = Math.floor(Date.now() / 1000)

    // §7.2: aud は送り先 URL そのもの (オリジンではない)。exp = iat + 300
    const claims: Record<string, string | number> = {
        iss: client.ccid,
        sub: client.ccid,
        aud: uri.audience,
        nonce: uri.nonce,
        iat: now,
        exp: now + ID_TOKEN_LIFETIME,
        jti: crypto.randomUUID(),
        concrnt_domain: client.server.domain
    }

    // §7.3: s に profile があるとき (省略時を含む) だけ、現在のプロフィールから自己申告で付ける
    if (uri.scope.includes('profile')) {
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

// §8.1 post / §8.3 エラー応答: 送り先 URL へ form-urlencoded で POST する
export const postResponse = async (redirectUri: string, params: Record<string, string>): Promise<void> => {
    let res: Response
    try {
        // §8.1: リダイレクトに追従しない (MUST NOT)。redirect: 'manual' のリダイレクトは status 0 の
        // opaqueredirect になるので、ok でないものを一律に失敗扱いにすればよい
        res = await fetch(redirectUri, {
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

// §8.2 fragment (同一端末): 応答パラメータをフラグメントに付けた送り先 URL を外部ブラウザで開く。
// フラグメントは HTTP リクエストに含まれないので、RP のサーバーログに ID Token が残らない
export const openFragmentResponse = async (redirectUri: string, params: Record<string, string>): Promise<void> => {
    try {
        await openUrl(`${redirectUri}#${new URLSearchParams(params).toString()}`)
    } catch {
        throw new ExternalAuthError('postFailed')
    }
}

const utf8 = (text: string): Uint8Array => new TextEncoder().encode(text)

// パディング無し base64url (CIP-2 §4)。btoa は Latin-1 しか受けないのでバイト列経由で変換する
const base64url = (bytes: Uint8Array): string =>
    btoa(String.fromCharCode(...bytes))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '')
