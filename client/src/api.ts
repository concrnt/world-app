import { KVS } from './cache'
import { AuthProvider } from './auth'
import {
    fetchWithTimeout,
    makeUrlSafe,
    parseHexString,
    renderUriTemplate,
    btoa,
    TimeoutError,
    NetworkError
} from './util'
import { CSID, FQDN, IsCCID, IsCSID, Document, SignedDocument, Entity } from './model'
import { parseCCURI } from './core'
import { ChunklineItem } from './chunkline'
import { CheckJwtIsValid, JwtPayload } from './crypto'

export class ServerOfflineError extends Error {
    constructor(server: string) {
        super(`server ${server} is offline`)
    }
}

export class NotFoundError extends Error {
    uri: string
    constructor(msg: string, uri: string) {
        super(msg)
        this.uri = uri
    }
}

export class PermissionError extends Error {
    constructor(msg: string) {
        super(msg)
    }
}

export interface ApiResponse<T> {
    content: T
    status: 'ok' | 'error'
    error: string
    next?: string
    prev?: string
}

// query/associations/acknowledgesエンドポイントのページング封筒 (CIP-5 §3.2)。
// prev/nextは日時カーソル文字列。Dateを経由するとms精度に丸まって境界を
// 取りこぼすため、文字列のまま次のsince/untilへエコーバックする。
export interface QueryResult {
    items: SignedDocument[]
    prev: string | null
    next: string | null
}

export interface FetchOptions<T> {
    // fallback: ネットワーク優先で、失敗時のみキャッシュを返す(オフラインフォールバック用)
    cache?: 'force-cache' | 'no-cache' | 'best-effort' | 'negative-only' | 'fallback'
    expressGetter?: (data: T) => void
    TTL?: number
    negativeTTL?: number
    auth?: 'no-auth'
    timeoutms?: number
}

export interface RepositoryImportResult {
    document?: string
    error?: string
}

export interface NotificationSubscription {
    vendorID: string
    owner: string
    schemas: string[]
    prefixes: string[]
    subscription: string
    cdate?: string
    mdate?: string
}

export class Api {
    authProvider: AuthProvider
    cache: KVS
    defaultHost: string = ''
    // 期限切れ後も即キャッシュを返しつつ裏で再取得する(SWR)ため、表示は常に高速なまま。
    // 明示invalidateされないリソースが恒久的にstaleになるのを防ぐ安全弁として有限にしている
    defaultCacheTTL: number = 1000 * 60 * 60 * 24
    negativeCacheTTL: number = 300
    tokens: Record<string, string> = {}
    self: SignedDocument | null = null

    onResourceUpdated?: (id: string) => void

    notifyResourceUpdate(id: string) {
        this.onResourceUpdated?.(id)
    }

    // ホストのオンライン/オフライン遷移時に一度だけ呼ばれる
    onHostOnlineStatusChanged?: (host: string, online: boolean) => void

    // バックオフ状態はプロセス内限定(永続KVSに書くと再起動をまたいで残ってしまう)
    private offlineState = new Map<string, { count: number; since: number }>()
    private onlineProbeMemo = new Map<string, number>()

    private inFlightRequests = new Map<string, Promise<any>>()

    constructor(host: string, authProvider: AuthProvider, cache: KVS) {
        this.defaultHost = host
        this.cache = cache
        this.authProvider = authProvider
    }

    async signJWT(claim: JwtPayload): Promise<string> {
        const ckid = this.authProvider.getCKID()

        const headerJson: Record<string, string> = {
            alg: 'CONCRNT',
            typ: 'JWT',
            kid: `cckv://${this.authProvider.getCCID()}/keys/${ckid}`
        }

        const header = JSON.stringify(headerJson)

        const payload = JSON.stringify(claim)

        const body = makeUrlSafe(btoa(header) + '.' + btoa(payload))

        const [hexSig, _] = await this.authProvider.signSub(body)

        const r_raw = parseHexString(hexSig.slice(0, 64))
        const s_raw = parseHexString(hexSig.slice(64, 128))
        const v = parseInt(hexSig.slice(128, 130), 16)

        const r_padded = new Uint8Array(32)
        r_padded.set(r_raw, 32 - r_raw.length)
        const s_padded = new Uint8Array(32)
        s_padded.set(s_raw, 32 - s_raw.length)

        const base64Sig = makeUrlSafe(btoa(String.fromCharCode.apply(null, [...r_padded, ...s_padded, v])))

        return body + '.' + base64Sig
    }

    async generateApiToken(remote: string): Promise<string> {
        const token = await this.signJWT({
            aud: remote,
            iss: `cckv://${this.authProvider.getCCID()}@${this.defaultHost}`,
            sub: 'concrnt',
            jti: crypto.randomUUID(),
            iat: Math.floor(new Date().getTime() / 1000).toString(),
            exp: Math.floor((new Date().getTime() + 5 * 60 * 1000) / 1000).toString()
        })

        this.tokens[remote] = token
        return token
    }

    async getAuthToken(remote: string): Promise<string> {
        let token = this.tokens[remote]
        if (!token || !CheckJwtIsValid(token)) {
            token = await this.generateApiToken(remote)
        }
        return token
    }

    async getHeaders(domain: string) {
        return {
            authorization: `Bearer ${await this.getAuthToken(domain)}`
        }
    }

    // バックオフゲートを迂回してホストへ直接プローブする(回復検知用)
    getServerOnlineStatus = async (host: string): Promise<boolean> => {
        const memo = this.onlineProbeMemo.get(host)
        if (memo && Date.now() - memo < 5000) {
            return true
        }

        try {
            const res = await fetchWithTimeout(
                `https://${host}/.well-known/concrnt`,
                { headers: { Accept: 'application/json' } },
                5000
            )
            if (!res.ok) throw new Error(`fetch failed on transport: ${res.status}`)
            this.onlineProbeMemo.set(host, Date.now())
            this.markHostOnline(host)
            return true
        } catch (_err) {
            this.onlineProbeMemo.delete(host)
            this.markHostOffline(host)
            return false
        }
    }

    private isHostOnline = (host: string): boolean => {
        if (typeof navigator !== 'undefined' && navigator.onLine === false) {
            // ゲートで弾く場合もオフライン遷移は通知する(hasガードでcount増加とsinceリセットを防ぐ)
            if (!this.offlineState.has(host)) {
                this.markHostOffline(host)
            }
            return false
        }
        const entry = this.offlineState.get(host)
        if (entry) {
            const age = Date.now() - entry.since
            const threshold = 500 * Math.pow(1.5, Math.min(entry.count, 15))
            if (age < threshold) {
                return false
            }
        }
        return true
    }

    private markHostOnline = (host: string) => {
        if (this.offlineState.delete(host)) {
            this.onHostOnlineStatusChanged?.(host, true)
        }
    }

    private markHostOffline = (host: string) => {
        const prev = this.offlineState.get(host)
        this.offlineState.set(host, { count: (prev?.count ?? 0) + 1, since: Date.now() })
        if (!prev) {
            this.onHostOnlineStatusChanged?.(host, false)
        }
    }

    async callConcrntApi<T>(host: string, api: string, args: Record<string, string>, init?: RequestInit): Promise<T> {
        const fetchHost = host || this.defaultHost
        const server = await this.getServer(fetchHost)

        const endpoint = renderUriTemplate(server, api, args)

        return this.fetchWithCredential<T>(fetchHost, endpoint, init)
    }

    async fetchWithCredential<T>(host: string, path: string, init: RequestInit = {}, timeoutms?: number): Promise<T> {
        const fetchHost = host || this.defaultHost

        try {
            const authHeaders = await this.getHeaders(fetchHost)
            init.headers = {
                ...init.headers,
                ...authHeaders
            }
        } catch (e) {
            console.error('failed to get auth headers', e)
        }

        return this.fetchHost<T>(fetchHost, path, init, timeoutms)
    }

    // Gets
    async fetchHost<T>(host: string, path: string, init: RequestInit = {}, timeoutms?: number): Promise<T> {
        const fetchNetwork = async (): Promise<T> => {
            const fetchHost = host || this.defaultHost
            const url = `https://${fetchHost}${path}`

            if (!this.isHostOnline(fetchHost)) {
                return Promise.reject(new ServerOfflineError(fetchHost))
            }

            init.headers = {
                Accept: 'application/json',
                ...init.headers
            }

            const req = fetchWithTimeout(url, init, timeoutms)
                .then(async (res) => {
                    switch (res.status) {
                        case 403:
                            throw new PermissionError(`fetch failed on transport: ${res.status} ${await res.text()}`)
                        case 404:
                            throw new NotFoundError(`fetch failed on transport: ${res.status} ${await res.text()}`, url)
                        case 502:
                        case 503:
                        case 504:
                            this.markHostOffline(fetchHost)
                            throw new ServerOfflineError(fetchHost)
                    }

                    if (!res.ok) {
                        return await Promise.reject(
                            new Error(`fetch failed on transport: ${res.status} ${await res.text()}`)
                        )
                    }

                    this.markHostOnline(fetchHost)

                    return await res.json()
                })
                .catch(async (err) => {
                    if (err instanceof ServerOfflineError) {
                        return Promise.reject(err)
                    }

                    if (
                        err instanceof TimeoutError ||
                        err instanceof NetworkError ||
                        ['ENOTFOUND', 'ECONNREFUSED'].includes((err.cause as any)?.code)
                    ) {
                        this.markHostOffline(fetchHost)
                        return Promise.reject(new ServerOfflineError(fetchHost))
                    }

                    return Promise.reject(err)
                })

            return req
        }

        return await fetchNetwork()
    }

    async fetchWithCache<T>(
        host: string | undefined,
        path: string,
        cacheKey: string,
        opts?: FetchOptions<T>
    ): Promise<T> {
        let cached: T | null = null
        if (opts?.cache !== 'no-cache') {
            const cachedEntry = await this.cache.get<T>(cacheKey)
            if (cachedEntry) {
                if (cachedEntry.data) {
                    opts?.expressGetter?.(cachedEntry.data)
                }

                cached = cachedEntry.data

                const age = Date.now() - cachedEntry.timestamp
                if (
                    age <
                    (cachedEntry.data
                        ? (opts?.TTL ?? this.defaultCacheTTL)
                        : (opts?.negativeTTL ?? this.negativeCacheTTL))
                ) {
                    // return cached if TTL is not expired
                    // fallbackモードはネットワーク優先なのでここでは返さない
                    if (opts?.cache !== 'fallback' && !(opts?.cache === 'best-effort' && !cachedEntry.data)) {
                        return cachedEntry.data
                    }
                }
            }
        }
        if (opts?.cache === 'force-cache') throw new Error('cache not found')

        const fetchNetwork = async (): Promise<T> => {
            const fetchHost = host || this.defaultHost
            const url = `https://${fetchHost}${path}`

            if (!this.isHostOnline(fetchHost)) {
                return Promise.reject(new ServerOfflineError(fetchHost))
            }

            if (this.inFlightRequests.has(cacheKey)) {
                return this.inFlightRequests.get(cacheKey)
            }

            // getHeadersのawait中に別callerがすり抜けて同一リクエストが並列発火しないよう、
            // in-flight登録(下のset)までをawaitなしで済ませる
            const authHeadersPromise: Promise<Record<string, string>> =
                opts?.auth !== 'no-auth'
                    ? this.getHeaders(fetchHost).catch((e) => {
                          console.error('failed to get auth headers', e)
                          return {}
                      })
                    : Promise.resolve({})

            const req = authHeadersPromise
                .then(async (authHeaders) => {
                    const requestOptions = {
                        method: 'GET',
                        headers: {
                            Accept: 'application/json',
                            ...authHeaders
                        }
                    }
                    return await fetchWithTimeout(url, requestOptions, opts?.timeoutms)
                })
                .then(async (res) => {
                    if (res.status === 403) {
                        return await Promise.reject(new PermissionError(await res.text()))
                    }

                    if ([502, 503, 504].includes(res.status)) {
                        this.markHostOffline(fetchHost)
                        return await Promise.reject(new ServerOfflineError(fetchHost))
                    }

                    if (!res.ok) {
                        if (res.status === 404) {
                            // 書き込み完了前にin-flightが解除されると後続callerがキャッシュミスして
                            // 同じリクエストを再発火するためawaitする(成功側も同様)
                            await this.cache.set(cacheKey, null)
                            throw new NotFoundError(`fetch failed on transport: ${res.status} ${await res.text()}`, url)
                        }
                        return await Promise.reject(
                            new Error(`fetch failed on transport: ${res.status} ${await res.text()}`)
                        )
                    }

                    this.markHostOnline(fetchHost)

                    const data: T = await res.json()

                    opts?.expressGetter?.(data)
                    if (opts?.cache !== 'negative-only') await this.cache.set(cacheKey, data)

                    return data
                })
                .catch(async (err) => {
                    if (err instanceof ServerOfflineError) {
                        return Promise.reject(err)
                    }

                    if (
                        err instanceof TimeoutError ||
                        err instanceof NetworkError ||
                        ['ENOTFOUND', 'ECONNREFUSED'].includes((err.cause as any)?.code)
                    ) {
                        this.markHostOffline(fetchHost)
                        return Promise.reject(new ServerOfflineError(fetchHost))
                    }

                    return Promise.reject(err)
                })
                .finally(() => {
                    this.inFlightRequests.delete(cacheKey)
                })

            this.inFlightRequests.set(cacheKey, req)

            return req
        }

        if (opts?.cache === 'fallback') {
            return await fetchNetwork().catch((err) => {
                if (cached) return cached
                throw err
            })
        }

        if (cached) {
            // swr
            fetchNetwork().catch(() => {}) // バックグラウンド更新の失敗はunhandledrejectionにしない
            return cached
        }

        return await fetchNetwork()
    }

    async getServer(remote: FQDN, opts?: FetchOptions<Server>): Promise<Server> {
        const cacheKey = `domain:${remote}`
        const path = '/.well-known/concrnt'
        const data = await this.fetchWithCache<Server>(remote, path, cacheKey, { ...opts, auth: 'no-auth' })
        if (!data) throw new NotFoundError(`domain ${remote} not found`, `https://${remote}${path}`)
        return data
    }

    async getServerByCSID(csid: CSID, hint?: string): Promise<Server> {
        const uri = hint ? `cckv://${csid}@${hint}` : `cckv://${csid}`

        const myServer = await this.getServer(this.defaultHost)

        const endpoint = renderUriTemplate(myServer, 'net.concrnt.core.resolve', {
            uri: uri,
            owner: csid
        })

        return this.fetchWithCache<Server>(this.defaultHost, endpoint, uri, {})
    }

    async getEntity(ccid: string, hint?: string, opts?: FetchOptions<SignedDocument>): Promise<Document<Entity>> {
        if (ccid.startsWith('cckv://')) {
            ccid = ccid.replace('cckv://', '').split('/')[0]
        }

        const uri = hint ? `cckv://${ccid}@${hint}` : `cckv://${ccid}`

        const server = await this.getServer(this.defaultHost)

        const endpoint = renderUriTemplate(server, 'net.concrnt.core.resolve', {
            uri: uri,
            owner: ccid
        })

        const sd = await this.fetchWithCache<SignedDocument>(this.defaultHost, endpoint, uri, { ...opts })

        const document: Document<Entity> = JSON.parse(sd.document)
        if (!document.kind) document.kind = 'entity'
        return document
    }

    async getDocument<T>(uri: string, domain?: string, opts?: FetchOptions<SignedDocument>): Promise<Document<T>> {
        const sd = await this.getResource<SignedDocument>(uri, domain, opts)
        // 負キャッシュ(404の記憶)にヒットするとgetResourceはnullを返す。
        // ネットワーク経由の404と同じ型のエラーにしないと、呼び出し側のNotFoundErrorハンドリングが機能しない
        if (!sd) {
            throw new NotFoundError(`fetch failed on negative cache: ${uri}`, uri)
        }
        const document: Document<T> = JSON.parse(sd.document)

        const legacy = document as any
        if ('signer' in legacy) {
            document.author = legacy.signer
            document.value = legacy.body
        }

        if (!document.kind) {
            if (document.schema === 'https://schema.concrnt.net/entity.json') document.kind = 'entity'
            else if (document.schema === 'https://schema.concrnt.net/delete.json') document.kind = 'delete'
            else if (document.schema === 'https://schema.concrnt.net/acknowledge.json') document.kind = 'ack'
            else if (document.schema === 'https://schema.concrnt.net/unacknowledge.json') document.kind = 'unack'
            else if (document.associate) document.kind = 'association'
            else document.kind = 'record'
        }

        return document
    }

    // owner(CCID/CSID/FQDN)からリソースの所在ドメインを解決する
    async resolveDomain(owner: string, hint?: string): Promise<FQDN> {
        let fqdn = owner
        if (IsCCID(fqdn)) {
            const entity = await this.getEntity(owner, hint)
            fqdn = entity.value.domain
        }
        if (IsCSID(fqdn)) {
            const server = await this.getServerByCSID(owner, hint)
            fqdn = server.domain
        }
        return fqdn
    }

    async getResource<T>(uri: string, hint?: string, opts?: FetchOptions<T>): Promise<T> {
        const parsed = URL.parse(uri)
        if (!parsed) {
            throw new Error(`invalid URI: ${uri}`)
        }
        const owner = parsed.host
        const key = parsed.pathname

        const fqdn = await this.resolveDomain(owner, hint)

        const server = await this.getServer(fqdn)

        const endpoint = renderUriTemplate(server, 'net.concrnt.core.resolve', {
            uri: uri,
            owner: owner,
            key: key.replace(/^\/+|\/+$/g, '')
        })

        const resource = this.fetchWithCache<T>(fqdn, endpoint, uri, opts ?? {})

        return resource
    }

    // net.concrnt.associations
    async getAssociations(
        uri: string,
        query: {
            schema?: string
            variant?: string
            author?: string
            since?: Date | string
            until?: Date | string
            limit?: string | number
            order?: string
        },
        hint?: string
    ): Promise<QueryResult> {
        const parsed = new URL(uri)
        const owner = parsed.host

        const fqdn = await this.resolveDomain(owner, hint)

        const server = await this.getServer(fqdn)

        const endpoint = renderUriTemplate(server, 'net.concrnt.core.associations', {
            ...query,
            uri: uri,
            since: query.since instanceof Date ? query.since.toISOString() : query.since,
            until: query.until instanceof Date ? query.until.toISOString() : query.until
        })

        return await this.fetchWithCredential<QueryResult>(fqdn, endpoint, {})
    }

    // 全ページを順に辿ってAssociationを全件取得する
    async getAssociationsAll(
        uri: string,
        query: {
            schema?: string
            variant?: string
            author?: string
        },
        hint?: string
    ): Promise<SignedDocument[]> {
        const collected = new Map<string, SignedDocument>()
        let cursor: string | undefined
        while (true) {
            const page = await this.getAssociations(uri, { ...query, limit: 100, until: cursor }, hint)
            for (const sd of page.items) collected.set(sd.ccfs, sd)
            if (!page.next || page.next === cursor) break
            cursor = page.next
        }
        return Array.from(collected.values())
    }

    // net.concrnt.association-counts
    async getAssociationCounts(uri: string, schema?: string, hint?: string): Promise<Record<string, number>> {
        const parsed = new URL(uri)
        const owner = parsed.host

        const fqdn = await this.resolveDomain(owner, hint)

        const server = await this.getServer(fqdn)

        const endpoint = renderUriTemplate(server, 'net.concrnt.core.association-counts', {
            uri: uri,
            schema: schema
        })

        return await this.fetchWithCredential<Record<string, number>>(fqdn, endpoint, {})
    }

    async query(
        query: {
            prefix?: string
            parent?: string
            schema?: string
            since?: Date | string
            until?: Date | string
            limit?: string | number
            order?: string
        },
        domain?: string,
        opts?: { cache?: boolean }
    ): Promise<QueryResult> {
        let fqdn = domain
        const key = query.prefix ?? query.parent
        if (!key) {
            throw new Error('prefix or parent is required')
        }
        if (!fqdn) {
            const parsed = new URL(key)
            fqdn = await this.resolveDomain(parsed.host)
        }

        if (!fqdn) {
            throw new Error('cannot determine server from query')
        }

        const server = await this.getServer(fqdn)

        const endpoint = renderUriTemplate(server, 'net.concrnt.core.query', {
            prefix: query.prefix,
            parent: query.parent,
            schema: query.schema,
            since: query.since instanceof Date ? query.since.toISOString() : query.since,
            until: query.until instanceof Date ? query.until.toISOString() : query.until,
            limit: query.limit,
            order: query.order
        })

        // ページング付きクエリはキャッシュキーが安定しないため対象外
        if (opts?.cache && !query.since && !query.until) {
            // v2: レスポンスが封筒形式になったため旧素配列キャッシュと分離
            const cacheKey = `query2:${fqdn}:${key}:${query.schema ?? ''}:${query.order ?? ''}:${query.limit ?? ''}`
            return await this.fetchWithCache<QueryResult>(fqdn, endpoint, cacheKey, { cache: 'fallback' })
        }

        const resource = this.fetchWithCredential<QueryResult>(fqdn, endpoint, {})

        return resource
    }

    // 全ページを順に辿って全件取得する。2ページ目以降の失敗は取得済み分を返す
    // (1ページ目のキャッシュフォールバックによるオフライン動作を保つため)
    async queryAll(
        query: {
            prefix?: string
            parent?: string
            schema?: string
            order?: string
        },
        domain?: string,
        opts?: { cache?: boolean }
    ): Promise<SignedDocument[]> {
        const collected = new Map<string, SignedDocument>()
        let cursor: string | undefined
        while (true) {
            const window = query.order === 'asc' ? { since: cursor } : { until: cursor }
            const page = await this.query({ ...query, limit: 100, ...window }, domain, opts).catch((err) => {
                if (collected.size === 0) throw err
                return null
            })
            if (page === null) break
            for (const sd of page.items) collected.set(sd.ccfs, sd)
            if (!page.next || page.next === cursor) break
            cursor = page.next
        }
        return Array.from(collected.values())
    }

    async requestConcrntApi<T>(
        host: string,
        api: string,
        params?: Record<string, string>,
        init?: RequestInit
    ): Promise<T> {
        const server = await this.getServer(host)
        const template = renderUriTemplate(server, api, params ?? {})
        return this.fetchHost<T>(host, template, init)
    }

    async commit<T>(document: Document<T>, domain?: string, opts?: { useMasterkey: boolean }): Promise<SignedDocument> {
        const docString = JSON.stringify(document)
        let signedDoc: Partial<SignedDocument> | undefined

        let references = undefined
        const ccid = this.authProvider.getCCID()
        if (!this.self) {
            this.self = await this.getResource<SignedDocument>(`cckv://${ccid}`)
            console.log('fetched self document for reference resolution', this.self)
        }
        references = this.self ? { [`cckv://${ccid}`]: this.self } : undefined

        if (document.schema === 'https://schema.concrnt.net/reference.json') {
            const ref = document.value as unknown as { href: string }
            if (ref.href.startsWith('cckv://') || ref.href.startsWith('ccfs://')) {
                const target = await this.getResource<SignedDocument>(ref.href)
                references = {
                    ...references,
                    [ref.href]: target
                }
            }
        }

        if (opts?.useMasterkey) {
            signedDoc = {
                document: docString,
                proof: {
                    type: 'concrnt-ecrecover-direct',
                    signature: await this.authProvider.signMaster(docString)
                },
                references
            }
        } else {
            const [signature, keyid] = await this.authProvider.signSub(docString)
            signedDoc = {
                document: docString,
                proof: {
                    type: 'concrnt-ecrecover-subkey',
                    signature: signature,
                    key: `cckv://${this.authProvider.getCCID()}/keys/${keyid}`
                },
                references
            }
        }

        const fetchHost = domain ?? this.defaultHost
        const server = await this.getServer(fetchHost)
        const endpoint = renderUriTemplate(server, 'net.concrnt.core.commit', {})

        const result = this.fetchHost<SignedDocument>(fetchHost, endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(signedDoc)
        })
            .then((sd) => {
                if (document.key) this.cache.invalidate(document.key)
                return sd
            })
            .catch((error) => {
                console.error('Error committing:', error)
                throw error
            })

        return result
    }

    async delete(uri: string, domain?: string): Promise<void> {
        // 削除対象のauthoritativeサーバーは対象URIオーナーのサーバー。
        // 非authoritativeサーバーに送るとReferences不一致でno-op(200)になり何も消えないため、
        // domain未指定ならオーナーのドメインを解決して直接送る。解決失敗時はホームサーバーに送る
        if (!domain) {
            try {
                const target = parseCCURI(uri.replace(/\/?\*$/, ''))
                if (IsCCID(target.owner) || IsCSID(target.owner)) {
                    domain = await this.resolveDomain(target.owner, target.hint)
                }
            } catch (e) {
                console.error('Failed to resolve delete target owner domain:', e)
            }
        }

        const documentObj: Document<string> = {
            kind: 'delete',
            author: this.authProvider.getCCID(),
            schema: 'https://schema.concrnt.net/delete.json',
            value: uri,
            createdAt: new Date()
        }

        await this.commit(documentObj, domain)
        // deleteドキュメントにはkeyが無いのでcommit側のinvalidateは効かない。
        // range記法(末尾の* / /*)は素のキーに落としてから無効化する
        this.cache.invalidate(uri.replace(/\/?\*$/, ''))
    }

    // ---

    // net.concrnt.world.repository (GET)
    // 自分の全commitをNDJSON(1行=SignedDocument, 時系列昇順)で取得する。
    // fetchHostはJSONパース前提なのでここは生fetchでテキストのまま返す
    async dumpRepository(host?: string): Promise<string> {
        const fetchHost = host || this.defaultHost
        const server = await this.getServer(fetchHost)
        const endpoint = renderUriTemplate(server, 'net.concrnt.world.repository', {})
        const authHeaders = await this.getHeaders(fetchHost)
        const res = await fetch(`https://${fetchHost}${endpoint}`, { headers: authHeaders })
        if (!res.ok) {
            throw new Error(`fetch failed on transport: ${res.status} ${await res.text()}`)
        }
        return await res.text()
    }

    // net.concrnt.world.repository (POST)
    // NDJSONをインポートする。レスポンスには失敗した行だけが返る
    async importRepository(jsonl: string, host?: string): Promise<RepositoryImportResult[]> {
        const fetchHost = host || this.defaultHost
        const server = await this.getServer(fetchHost)
        const endpoint = renderUriTemplate(server, 'net.concrnt.world.repository', {})
        return await this.fetchWithCredential<RepositoryImportResult[]>(
            fetchHost,
            endpoint,
            {
                method: 'POST',
                headers: { 'Content-Type': 'text/plain' },
                body: jsonl
            },
            60 * 1000
        )
    }

    // net.concrnt.world.register (DELETE)
    // 引っ越し完了後などに、このサーバー上の登録(entity meta)を解除する。
    // entityが既に他ドメインを指していないとサーバー側で拒否される
    async unregister(host?: string): Promise<void> {
        const fetchHost = host || this.defaultHost
        await this.callConcrntApi(fetchHost, 'net.concrnt.world.register', {}, { method: 'DELETE' })
    }

    // ---

    async getTimelineRecent(timelines: string[], host?: string): Promise<ChunklineItem[]> {
        return this.getTimelineRanged(timelines, {}, host)
    }

    async getTimelineRanged(
        timelines: string[],
        param: { until?: Date; since?: Date; limit?: number },
        host?: string
    ): Promise<ChunklineItem[]> {
        const server = await this.getServer(host ?? this.defaultHost)
        const endpoint = renderUriTemplate(server, 'net.concrnt.world.timeline.recent', {
            uris: timelines.join(','),
            since: param.since ? Math.floor(param.since.getTime()).toString() : undefined,
            until: param.until ? Math.ceil(param.until.getTime()).toString() : undefined,
            limit: param.limit?.toString()
        })

        const resp = await this.fetchWithCredential<ChunklineItem[]>(host ?? this.defaultHost, endpoint)
        return resp.map((item) => ({ ...item, timestamp: new Date(item.timestamp) }))
    }

    // ---

    async subscribeNotification(
        owner: string,
        vendorID: string,
        sub: { schemas: string[]; prefixes: string[]; subscription: string },
        host?: string
    ): Promise<NotificationSubscription> {
        const fetchHost = host ?? this.defaultHost
        const resp = await this.callConcrntApi<ApiResponse<NotificationSubscription>>(
            fetchHost,
            'net.concrnt.world.subscribe',
            { owner, vendor_id: vendorID },
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ vendorID, owner, ...sub })
            }
        )
        return resp.content
    }

    async getNotificationSubscription(
        owner: string,
        vendorID: string,
        host?: string
    ): Promise<NotificationSubscription> {
        const fetchHost = host ?? this.defaultHost
        const resp = await this.callConcrntApi<ApiResponse<NotificationSubscription>>(
            fetchHost,
            'net.concrnt.world.subscribe',
            { owner, vendor_id: vendorID }
        )
        return resp.content
    }

    async deleteNotificationSubscription(owner: string, vendorID: string, host?: string): Promise<void> {
        const fetchHost = host ?? this.defaultHost
        await this.callConcrntApi<ApiResponse<NotificationSubscription>>(
            fetchHost,
            'net.concrnt.world.subscribe',
            { owner, vendor_id: vendorID },
            { method: 'DELETE' }
        )
    }
}

export interface Server {
    version: string
    domain: string
    csid: CSID
    layer: string
    meta?: any
    endpoints: Record<string, string>
}
