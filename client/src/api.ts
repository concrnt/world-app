import { KVS } from './cache'
import { AuthProvider } from './auth'
import { fetchWithTimeout, renderUriTemplate } from './util'
import { CCID, CSID, FQDN, IsCCID, IsCSID, Document, SignedDocument } from './model'
import { ChunklineItem } from './chunkline'

export class ServerOfflineError extends Error {
    constructor(server: string) {
        super(`server ${server} is offline`)
    }
}

export class NotFoundError extends Error {
    constructor(msg: string) {
        super(msg)
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
    cache?: 'force-cache' | 'no-cache' | 'best-effort' | 'negative-only'
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

    private inFlightRequests = new Map<string, Promise<any>>()

    constructor(authProvider: AuthProvider, cache: KVS) {
        this.cache = cache
        this.authProvider = authProvider

        this.defaultHost = authProvider.getHost()
    }

    getServerOnlineStatus = async (host: string): Promise<boolean> => {
        const cacheKey = `online:${host}`
        const entry = await this.cache.get<number>(cacheKey)
        if (entry) {
            const age = Date.now() - entry.timestamp
            if (age < 5000) {
                return true
            }
        }

        return await this.getServer(host, { cache: 'no-cache' })
            .then(() => {
                this.cache.set(cacheKey, 1)
                return true
            })
            .catch(() => {
                this.cache.invalidate(cacheKey)
                return false
            })
    }

    private isHostOnline = async (host: string): Promise<boolean> => {
        const cacheKey = `offline:${host}`
        const entry = await this.cache.get<number>(cacheKey)
        if (entry) {
            const age = Date.now() - entry.timestamp
            const threshold = 500 * Math.pow(1.5, Math.min(entry.data, 15))
            if (age < threshold) {
                return false
            }
        }
        return true
    }

    private markHostOnline = async (host: string) => {
        const cacheKey = `offline:${host}`
        this.cache.invalidate(cacheKey)
    }

    private markHostOffline = async (host: string) => {
        const cacheKey = `offline:${host}`
        const failCount = (await this.cache.get<number>(cacheKey))?.data ?? 0
        this.cache.set(cacheKey, failCount + 1)
    }

    async fetchWithCredential<T>(host: string, path: string, init: RequestInit = {}, timeoutms?: number): Promise<T> {
        const fetchHost = host || this.defaultHost

        try {
            const authHeaders = await this.authProvider.getHeaders(fetchHost)
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

            if (!(await this.isHostOnline(fetchHost))) {
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
                            throw new NotFoundError(`fetch failed on transport: ${res.status} ${await res.text()}`)
                        case 502:
                        case 503:
                        case 504:
                            await this.markHostOffline(fetchHost)
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

                    if (['ENOTFOUND', 'ECONNREFUSED'].includes(err.cause?.code)) {
                        await this.markHostOffline(fetchHost)
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
                    if (!(opts?.cache === 'best-effort' && !cachedEntry.data)) return cachedEntry.data
                }
            }
        }
        if (opts?.cache === 'force-cache') throw new Error('cache not found')

        const fetchNetwork = async (): Promise<T> => {
            const fetchHost = host || this.defaultHost
            const url = `https://${fetchHost}${path}`

            if (!(await this.isHostOnline(fetchHost))) {
                return Promise.reject(new ServerOfflineError(fetchHost))
            }

            if (this.inFlightRequests.has(cacheKey)) {
                return this.inFlightRequests.get(cacheKey)
            }

            let authHeaders = {}
            if (opts?.auth !== 'no-auth') {
                try {
                    authHeaders = await this.authProvider.getHeaders(fetchHost)
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
                        await this.markHostOffline(fetchHost)
                        return await Promise.reject(new ServerOfflineError(fetchHost))
                    }

                    if (!res.ok) {
                        if (res.status === 404) {
                            this.cache.set(cacheKey, null)
                            throw new NotFoundError(`fetch failed on transport: ${res.status} ${await res.text()}`)
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

                    if (['ENOTFOUND', 'ECONNREFUSED'].includes(err.cause?.code)) {
                        await this.markHostOffline(fetchHost)
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

        if (cached) {
            // swr
            fetchNetwork()
            return cached
        }

        return await fetchNetwork()
    }

    async getServer(remote: FQDN, opts?: FetchOptions<Server>): Promise<Server> {
        const cacheKey = `domain:${remote}`
        const path = '/.well-known/concrnt'
        const data = await this.fetchWithCache<Server>(remote, path, cacheKey, { ...opts, auth: 'no-auth' })
        if (!data) throw new NotFoundError(`domain ${remote} not found`)
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

    async getEntity(ccid: string, hint?: string): Promise<Entity> {
        const uri = hint ? `cckv://${ccid}@${hint}` : `cckv://${ccid}`

        const server = await this.getServer(this.defaultHost)

        const endpoint = renderUriTemplate(server, 'net.concrnt.core.resolve', {
            uri: uri,
            owner: ccid
        })

        return this.fetchWithCache<Entity>(this.defaultHost, endpoint, uri, {})
    }

    async getDocument<T>(uri: string, domain?: string): Promise<Document<T>> {
        const sd = await this.getResource<SignedDocument>(uri, domain)
        const document: Document<T> = JSON.parse(sd.document)

        const legacy = document as any
        if ('signer' in legacy) {
            document.author = legacy.signer
            document.value = legacy.body
        }

        return document
    }

    async getResource<T>(uri: string, hint?: string): Promise<T> {
        const parsed = new URL(uri)
        const owner = parsed.host
        const key = parsed.pathname

        let fqdn = owner
        if (IsCCID(fqdn)) {
            const entity = await this.getEntity(owner, hint)
            fqdn = entity.domain
        }
        if (IsCSID(fqdn)) {
            const server = await this.getServerByCSID(owner, hint)
            fqdn = server.domain
        }

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
    async getAssociations<T>(
        uri: string,
        query: {
            schema?: string
            variant?: string
            author?: string
        },
        hint?: string
    ): Promise<Array<Document<T>>> {
        const parsed = new URL(uri)
        const owner = parsed.host

        let fqdn = owner
        if (IsCCID(fqdn)) {
            const entity = await this.getEntity(owner, hint)
            fqdn = entity.domain
        }
        if (IsCSID(fqdn)) {
            const server = await this.getServerByCSID(owner, hint)
            fqdn = server.domain
        }

        const server = await this.getServer(fqdn)

        const endpoint = renderUriTemplate(server, 'net.concrnt.core.associations', {
            uri: uri,
            ...query
        })

        return await this.fetchWithCredential<Array<Document<T>>>(fqdn, endpoint, {})
    }

    // net.concrnt.association-counts
    async getAssociationCounts(uri: string, schema?: string, hint?: string): Promise<Record<string, number>> {
        const parsed = new URL(uri)
        const owner = parsed.host

        let fqdn = owner
        if (IsCCID(fqdn)) {
            const entity = await this.getEntity(owner, hint)
            fqdn = entity.domain
        }
        if (IsCSID(fqdn)) {
            const server = await this.getServerByCSID(owner, hint)
            fqdn = server.domain
        }

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
            schema?: string
            since?: string
            until?: string
            limit?: string
            order?: string
        },
        domain?: string
    ): Promise<SignedDocument[]> {
        let fqdn = domain
        if (!fqdn) {
            fqdn = this.defaultHost
        }

        const server = await this.getServer(fqdn)

        const endpoint = renderUriTemplate(server, 'net.concrnt.core.query', {
            prefix: query.prefix,
            schema: query.schema,
            since: query.since,
            until: query.until,
            limit: query.limit,
            order: query.order
        })

        const resource = this.fetchWithCredential<SignedDocument[]>(fqdn, endpoint, {})

        return resource
    }

    async requestConcrntApi<T>(
        host: string,
        api: string,
        opts: { params?: Record<string, string>; query?: string },
        init?: RequestInit
    ): Promise<T> {
        const server = await this.getServer(host)

        const endpoint = server.endpoints[api]
        let template = endpoint.template
        if (opts.params) {
            for (const [key, value] of Object.entries(opts.params)) {
                template = template.replaceAll(`{${key}}`, value)
            }
        }

        if (opts.query) {
            template += opts.query
        }

        return this.fetchHost<T>(host, template, init)
    }

    async commit<T>(document: Document<T>, domain?: string): Promise<void> {
        const docString = JSON.stringify(document)
        const signature = this.authProvider.sign(docString)

        const signedDoc = {
            document: docString,
            proof: {
                type: 'concrnt-ecrecover-direct',
                signature: signature
            }
        }

        const result = fetch(`https://${domain ?? this.defaultHost}/commit`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(signedDoc)
        })
            .then((response) => {
                if (!response.ok) {
                    throw new Error(`Server responded with ${response.status}`)
                }
                return response.json()
            })
            .then((_) => {
                // TODO: use result
                const key = document.key?.startsWith('/') ? document.key.slice(1) : document.key
                const uri = `cckv://${document.owner ?? document.author}/${key}`

                this.cache.invalidate(uri)
            })
            .catch((error) => {
                console.error('Error committing:', error)
            })

        return result
    }

    async delete(uri: string, domain?: string): Promise<void> {
        const documentObj: Document<string> = {
            author: this.authProvider.getCCID(),
            schema: 'https://schema.concrnt.net/delete.json',
            value: uri,
            createdAt: new Date()
        }

        return this.commit(documentObj, domain)
    }

    // ---

    async getTimelineRecent(timelines: string[]): Promise<ChunklineItem[]> {
        const requestPath = `/api/v1/timeline/recent?uris=${timelines.join(',')}`
        const resp = await this.fetchWithCredential<ChunklineItem[]>(this.defaultHost, requestPath)
        return resp
    }

    async getTimelineRanged(
        timelines: string[],
        param: { until?: Date; since?: Date },
        host?: string
    ): Promise<ChunklineItem[]> {
        const sinceQuery = !param.since ? '' : `&since=${Math.floor(param.since.getTime() / 1000)}`
        const untilQuery = !param.until ? '' : `&until=${Math.ceil(param.until.getTime() / 1000)}`

        const requestPath = `/api/v1/timeline/recent?uris=${timelines.join(',')}${sinceQuery}${untilQuery}`
        const resp = await this.fetchWithCredential<ChunklineItem[]>(host ?? this.defaultHost, requestPath)
        return resp
    }
}

export interface ConcrntApiEndpoint {
    template: string
    method: 'GET' | 'POST' | 'PUT' | 'DELETE'
    query?: string[]
}

export interface Server {
    version: string
    domain: string
    csid: CSID
    layer: string
    endpoints: Record<string, ConcrntApiEndpoint>
}

export interface Entity {
    ccid: CCID
    alias?: string
    domain: FQDN
    tag: string

    affiliationDocument: string
    affiliationSignature: string

    cdate: string
}
