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

export interface FetchOptions<T> {
    // fallback: ネットワーク優先で、失敗時のみキャッシュを返す(オフラインフォールバック用)
    cache?: 'force-cache' | 'no-cache' | 'best-effort' | 'negative-only' | 'fallback'
    expressGetter?: (data: T) => void
    TTL?: number
    auth?: 'no-auth'
    timeoutms?: number
}

export class Api {
    authProvider: AuthProvider
    cache: KVS
    defaultHost: string = ''
    defaultCacheTTL: number = Infinity
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
                if (age < (cachedEntry.data ? (opts?.TTL ?? this.defaultCacheTTL) : this.negativeCacheTTL)) {
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

            let authHeaders = {}
            if (opts?.auth !== 'no-auth') {
                try {
                    authHeaders = await this.getHeaders(fetchHost)
                } catch (e) {
                    console.error('failed to get auth headers', e)
                }
            }

            const requestOptions = {
                method: 'GET',
                headers: {
                    Accept: 'application/json',
                    ...authHeaders
                }
            }

            const req = fetchWithTimeout(url, requestOptions, opts?.timeoutms)
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
                            this.cache.set(cacheKey, null)
                            throw new NotFoundError(`fetch failed on transport: ${res.status} ${await res.text()}`, url)
                        }
                        return await Promise.reject(
                            new Error(`fetch failed on transport: ${res.status} ${await res.text()}`)
                        )
                    }

                    this.markHostOnline(fetchHost)

                    const data: T = await res.json()

                    opts?.expressGetter?.(data)
                    if (opts?.cache !== 'negative-only') this.cache.set(cacheKey, data)

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

    async getEntity(ccid: string, hint?: string): Promise<Document<Entity>> {
        if (ccid.startsWith('cckv://')) {
            ccid = ccid.replace('cckv://', '').split('/')[0]
        }

        const uri = hint ? `cckv://${ccid}@${hint}` : `cckv://${ccid}`

        const server = await this.getServer(this.defaultHost)

        const endpoint = renderUriTemplate(server, 'net.concrnt.core.resolve', {
            uri: uri,
            owner: ccid
        })

        const sd = await this.fetchWithCache<SignedDocument>(this.defaultHost, endpoint, uri, {})

        const document: Document<Entity> = JSON.parse(sd.document)
        if (!document.kind) document.kind = 'entity'
        return document
    }

    async getDocument<T>(uri: string, domain?: string): Promise<Document<T>> {
        const sd = await this.getResource<SignedDocument>(uri, domain)
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

    async getResource<T>(uri: string, hint?: string): Promise<T> {
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

        const resource = this.fetchWithCache<T>(fqdn, endpoint, uri, {})

        return resource
    }

    // net.concrnt.associations
    async getAssociations(
        uri: string,
        query: {
            schema?: string
            variant?: string
            author?: string
        },
        hint?: string
    ): Promise<Array<SignedDocument>> {
        const parsed = new URL(uri)
        const owner = parsed.host

        const fqdn = await this.resolveDomain(owner, hint)

        const server = await this.getServer(fqdn)

        const endpoint = renderUriTemplate(server, 'net.concrnt.core.associations', {
            uri: uri,
            ...query
        })

        return await this.fetchWithCredential<Array<SignedDocument>>(fqdn, endpoint, {})
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
            since?: Date
            until?: Date
            limit?: string | number
            order?: string
        },
        domain?: string,
        opts?: { cache?: boolean }
    ): Promise<SignedDocument[]> {
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
            since: query.since ? query.since.toISOString() : undefined,
            until: query.until ? query.until.toISOString() : undefined,
            limit: query.limit,
            order: query.order
        })

        // ページング付きクエリはキャッシュキーが安定しないため対象外
        if (opts?.cache && !query.since && !query.until) {
            const cacheKey = `query:${fqdn}:${key}:${query.schema ?? ''}:${query.order ?? ''}:${query.limit ?? ''}`
            return await this.fetchWithCache<SignedDocument[]>(fqdn, endpoint, cacheKey, { cache: 'fallback' })
        }

        const resource = this.fetchWithCredential<SignedDocument[]>(fqdn, endpoint, {})

        return resource
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
        const documentObj: Document<string> = {
            kind: 'delete',
            author: this.authProvider.getCCID(),
            schema: 'https://schema.concrnt.net/delete.json',
            value: uri,
            createdAt: new Date()
        }

        await this.commit(documentObj, domain)
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
}

export interface Server {
    version: string
    domain: string
    csid: CSID
    layer: string
    meta?: any
    endpoints: Record<string, string>
}
