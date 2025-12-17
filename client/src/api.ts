
import { KVS } from "./cache"
import { AuthProvider } from "./auth"
import { fetchWithTimeout } from "./util"
import { CCID, CSID, FQDN, IsCCID, IsCSID, Document } from "./model"

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

        return await this.getServer(host, { cache: 'no-cache' }).then(() => {
            this.cache.set(cacheKey, 1)
            return true
        }).catch(() => {
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

    async fetchWithCredential<T>(
        host: string,
        path: string,
        init: RequestInit = {},
        timeoutms?: number
    ): Promise<T> {

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
    async fetchHost<T>(
        host: string,
        path: string,
        init: RequestInit = {},
        timeoutms?: number
    ): Promise<T> {

        const fetchNetwork = async (): Promise<T> => {
            const fetchHost = host || this.defaultHost
            const url = `https://${fetchHost}${path}`

            if (!(await this.isHostOnline(fetchHost))) {
                return Promise.reject(new ServerOfflineError(fetchHost))
            }

            init.headers = {
                'Accept': 'application/json',
                ...init.headers,
            }
            
            const req = fetchWithTimeout(url, init, timeoutms).then(async (res) => {

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
                    return await Promise.reject(new Error(`fetch failed on transport: ${res.status} ${await res.text()}`))
                }

                this.markHostOnline(fetchHost)

                return await res.json()

            }).catch(async (err) => {

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
        cls: new () => T extends (infer U)[] ? U : T,
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
                    if (Array.isArray(cachedEntry.data)) {
                        cachedEntry.data.map((item) => Object.setPrototypeOf(item, cls.prototype))
                    } else {
                        Object.setPrototypeOf(cachedEntry.data, cls.prototype)
                    }
                    opts?.expressGetter?.(cachedEntry.data)
                }

                cached = cachedEntry.data

                const age = Date.now() - cachedEntry.timestamp
                if (age < (cachedEntry.data ? (opts?.TTL ?? this.defaultCacheTTL) : this.negativeCacheTTL)) { // return cached if TTL is not expired
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
                    'Accept': 'application/json',
                    ...authHeaders
                }
            }
            
            const req = fetchWithTimeout(url, requestOptions, opts?.timeoutms).then(async (res) => {

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
                        return null
                    }
                    return await Promise.reject(new Error(`fetch failed on transport: ${res.status} ${await res.text()}`))
                }

                this.markHostOnline(fetchHost)

                const data: T = await res.json()
                
                opts?.expressGetter?.(data)
                if (opts?.cache !== 'negative-only') this.cache.set(cacheKey, data)

                if (Array.isArray(data)) {
                    return data.map((item) => Object.setPrototypeOf(item, cls.prototype))
                } else {
                    return Object.setPrototypeOf(data, cls.prototype)
                }

            }).catch(async (err) => {

                if (err instanceof ServerOfflineError) {
                    return Promise.reject(err)
                }

                if (['ENOTFOUND', 'ECONNREFUSED'].includes(err.cause?.code)) {
                    await this.markHostOffline(fetchHost)
                    return Promise.reject(new ServerOfflineError(fetchHost))
                }

                return Promise.reject(err)

            }).finally(() => {

                this.inFlightRequests.delete(cacheKey)

            })

            this.inFlightRequests.set(cacheKey, req)

            return req
        }

        if (cached) { // swr
            fetchNetwork()
            return cached
        }

        return await fetchNetwork()
    }

    async getServer(remote: FQDN, opts?: FetchOptions<Server>): Promise<Server> {
        const cacheKey = `domain:${remote}`
        const path = '/.well-known/concrnt'
        const data = await this.fetchWithCache<Server>(Server, remote, path, cacheKey, { ...opts, auth: 'no-auth' })
        if (!data) throw new NotFoundError(`domain ${remote} not found`)
        return data
    }

    async getServerByCSID(csid: CSID): Promise<Server> {
        let uri = `cc://${csid}`

        const server = await this.getResource<Server>(Server, uri, this.defaultHost)
        return server
    }

    async getEntity(ccid: string, hint?: string): Promise<Entity> {
        let uri = `cc://${ccid}`

        const entity = await this.getResource<Entity>(Entity, uri, hint ?? this.defaultHost)
        return entity
    }

    async getResource<T>(
        cls: new () => T extends (infer U)[] ? U : T,
        uri: string,
        domain?: string
    ): Promise<T> {
        const parsed = new URL(uri)
        const owner = parsed.host
        const key = parsed.pathname

        let fqdn = domain
        if (!fqdn) {
            fqdn = owner
            if (IsCCID(owner)) {
                const entity = await this.getEntity(owner)
                fqdn = entity.domain
            }
            if (IsCSID(owner)) {
                const server = await this.getServerByCSID(owner)
                fqdn = server.domain
            }
        }

        const server = await this.getServer(fqdn)

        let endpoint = server.endpoints['net.concrnt.core.resource'].template
            .replaceAll('{uri}', uri)
            .replaceAll('{owner}', owner)
            .replaceAll('{key}', key)

        const resource = this.fetchWithCache<T>(
            cls,
            fqdn,
            endpoint,
            uri,
            {},
        )

        return resource
    }

    async requestConcrntApi<T>(host: string, api: string, opts: {params?: Record<string, string>, query?: string}, init?: RequestInit): Promise<T> {

        const server = await this.getServer(host)
        
        let endpoint = server.endpoints[api]
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
                type: "concrnt-ecrecover-direct",
                signature: signature
            }
        }

        return fetch(`https://${domain ?? this.defaultHost}/commit`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(signedDoc)
        }).then(response => {
            if (!response.ok) {
                throw new Error(`Server responded with ${response.status}`);
            }
            return response.json();
        }).then(data => {
            console.log("Affiliation committed successfully:", data);
        }).catch(error => {
            console.error("Error committing affiliation:", error);
        });
    }
}

export interface ConcrntApiEndpoint {
    template: string
    method: 'GET' | 'POST' | 'PUT' | 'DELETE'
    query?: string[]
}

export class Server {
    version: string = ''
    domain: string = ''
    csid: CSID = ''
    layer: string = ''
    endpoints: Record<string, ConcrntApiEndpoint> = {}
}

export class Entity {
    ccid: CCID = ''
    alias?: string
    domain: FQDN = ''
    tag: string = ''

    affiliationDocument: string = ''
    affiliationSignature: string = ''

    cdate: string = ''
}

