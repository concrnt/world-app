import {
    Api,
    type FQDN,
    TimelineReader,
    QueryTimelineReader,
    Document,
    CCID,
    Server,
    NotFoundError,
    Socket,
    AuthProvider,
    KVS,
    SignedDocument,
    Acknowledge
} from '@concrnt/client'
import { ListSchema } from './schemas/'
import { User } from './user'
import { List } from './list'
import { Message } from './message'
import { Timeline } from './timeline'
import { semantics } from './semantics'
import { Schemas } from './schemas'
import { isFulfilled } from './util'

const cacheLifetime = 5 * 60 * 1000
interface Cache<T> {
    data: T
    expire: number
}

export class Client {
    api: Api
    ccid: string
    server: Server

    user: User | null = null
    home: List | null = null

    sockets: Record<string, Socket> = {}

    messageCache: Record<string, Cache<Promise<Message<any> | null>>> = {}

    acknowledging: Document<Acknowledge>[] = []
    acknowledgers: Document<Acknowledge>[] = []

    knownCommunities: Timeline[] = []

    constructor(api: Api, ccid: string, server: Server) {
        this.api = api
        this.ccid = ccid
        this.server = server

        this.api.onResourceUpdated = (uri) => {
            delete this.messageCache[uri]
        }
    }

    static async create(host: FQDN, authProvider: AuthProvider, cacheEngine: KVS): Promise<Client> {
        const api = new Api(host, authProvider, cacheEngine)

        const server = await api.getServer(host)
        const ccid = authProvider.getCCID()

        const client = new Client(api, ccid, server)
        if (ccid === '') return client

        client.user = await client.getUser(ccid).catch(() => null)

        // ==== Default kit ====
        await api.getDocument(semantics.homeTimeline(api.authProvider.getCCID())).catch((err) => {
            if (err instanceof NotFoundError) {
                console.log('Home timeline not found, creating a new one...')
                const document = {
                    key: semantics.homeTimeline(api.authProvider.getCCID()),
                    author: api.authProvider.getCCID(),
                    schema: 'https://schema.concrnt.world/t/empty.json',
                    value: {},
                    createdAt: new Date(),
                    policies: [
                        {
                            url: 'https://policy.concrnt.world/t/inline-allow-deny.json',
                            params: {
                                readListMode: false,
                                reader: [],
                                writeListMode: true,
                                writer: [api.authProvider.getCCID()]
                            }
                        }
                    ]
                }
                api.commit(document)
                return document
            }
            throw err
        })

        await api.getDocument(semantics.notificationTimeline(api.authProvider.getCCID())).catch((err) => {
            if (err instanceof NotFoundError) {
                console.log('Notification timeline not found, creating a new one...')
                const document = {
                    key: semantics.notificationTimeline(api.authProvider.getCCID()),
                    author: api.authProvider.getCCID(),
                    schema: 'https://schema.concrnt.world/t/empty.json',
                    value: {},
                    createdAt: new Date(),
                    policies: [
                        {
                            url: 'https://policy.concrnt.world/t/inline-allow-deny.json',
                            params: {
                                readListMode: true,
                                reader: [api.authProvider.getCCID()],
                                writeListMode: false,
                                writer: []
                            }
                        }
                    ]
                }
                api.commit(document)
                return document
            }
            throw err
        })

        await api.getDocument(semantics.activityTimeline(api.authProvider.getCCID())).catch((err) => {
            if (err instanceof NotFoundError) {
                console.log('Activity timeline not found, creating a new one...')
                const document = {
                    key: semantics.activityTimeline(api.authProvider.getCCID()),
                    author: api.authProvider.getCCID(),
                    schema: 'https://schema.concrnt.world/t/empty.json',
                    value: {},
                    createdAt: new Date(),
                    policies: [
                        {
                            url: 'https://policy.concrnt.world/t/inline-allow-deny.json',
                            params: {
                                readListMode: false,
                                reader: [],
                                writeListMode: true,
                                writer: [api.authProvider.getCCID()]
                            }
                        }
                    ]
                }
                api.commit(document)
                return document
            }
            throw err
        })

        client.home = await List.load(client, semantics.homeList(api.authProvider.getCCID())).catch((err) => {
            if (err instanceof NotFoundError) {
                console.log('Home list not found, creating a new one...')
                const document: Document<ListSchema> = {
                    key: semantics.homeList(api.authProvider.getCCID()),
                    author: api.authProvider.getCCID(),
                    schema: 'https://schema.concrnt.world/utils/list.json',
                    value: {
                        title: 'Home',
                        items: []
                    },
                    createdAt: new Date()
                }
                api.commit(document)

                return new List(semantics.homeList(api.authProvider.getCCID()), document.value.title)
            } else {
                throw err
            }
        })

        client.acknowledgers = await client.getAcknowledgers(client.ccid)
        client.acknowledging = await client.getAcknowledging(client.ccid)

        client.api
            .query({
                prefix: semantics.lists(client.ccid),
                schema: Schemas.communityTimeline
            })
            .then((res) => {
                Promise.allSettled(res.map((sd) => Timeline.loadFromReferenceSD(client, sd))).then(
                    (results) =>
                        (client.knownCommunities = results
                            .filter(isFulfilled)
                            .map((r) => r.value)
                            .filter((t): t is Timeline => t !== null))
                )
            })

        // =====================

        return client
    }

    async newSocket(host?: string): Promise<Socket> {
        const targetHost = host ?? this.server.domain
        if (!this.sockets[targetHost]) {
            this.sockets[targetHost] = new Socket(this.api, host)
            await this.sockets[targetHost].waitOpen()
        }
        return this.sockets[targetHost]
    }

    async newTimelineReader(opts?: { withoutSocket: boolean; hostOverride?: string }): Promise<TimelineReader> {
        if (opts?.withoutSocket) {
            return new TimelineReader(this.api, undefined)
        }
        const socket = await this.newSocket(opts?.hostOverride)
        return new TimelineReader(this.api, socket, opts?.hostOverride)
    }

    async newQueryTimelineReader(): Promise<QueryTimelineReader> {
        return new QueryTimelineReader(this.api)
    }

    getMessage<T>(uri: string, hint?: string): Promise<Message<T> | null> {
        const cached = this.messageCache[uri]

        if (cached && cached.expire > Date.now()) {
            return cached.data
        }

        const msg = Message.load<T>(this, uri, hint)
        this.messageCache[uri] = {
            data: msg,
            expire: Date.now() + cacheLifetime
        }
        return msg
    }

    async getUser(id: CCID, hint?: string): Promise<User | null> {
        return User.load(this, id, hint).catch(() => null)
    }

    async getTimeline(uri: string, hint?: string): Promise<Timeline | null> {
        return Timeline.load(this, uri, hint).catch(() => null)
    }

    async getList(uri: string, hint?: string): Promise<List | null> {
        return List.load(this, uri, hint).catch(() => null)
    }

    async Acknowledge(to: string): Promise<void> {
        const document = {
            author: this.ccid,
            schema: 'https://schema.concrnt.net/acknowledge.json',
            value: {
                context: 'world.concrnt.ack'
            },
            associate: semantics.user(to),
            createdAt: new Date()
        }
        await this.api.commit(document)
        await this.reloadAcknowledges()
    }

    async UnAcknowledge(to: string): Promise<void> {
        const document = {
            author: this.ccid,
            schema: 'https://schema.concrnt.net/unacknowledge.json',
            value: {
                context: 'world.concrnt.ack'
            },
            associate: semantics.user(to),
            createdAt: new Date()
        }
        await this.api.commit(document)
        await this.reloadAcknowledges()
    }

    getAcknowledging(ccid: string): Promise<Document<Acknowledge>[]> {
        return this.api
            .requestConcrntApi<Array<SignedDocument>>(this.server.domain, 'net.concrnt.core.acknowledges', {
                from: ccid,
                context: 'world.concrnt.ack'
            })
            .then((res) => res.map((sd) => JSON.parse(sd.document)))
    }

    async getAcknowledgers(ccid: string): Promise<Document<Acknowledge>[]> {
        return this.api
            .requestConcrntApi<Array<SignedDocument>>(this.server.domain, 'net.concrnt.core.acknowledges', {
                to: ccid,
                context: 'world.concrnt.ack'
            })
            .then((res) => res.map((sd) => JSON.parse(sd.document)))
    }

    async reloadAcknowledges(): Promise<void> {
        this.acknowledging = await this.getAcknowledging(this.ccid)
        this.acknowledgers = await this.getAcknowledgers(this.ccid)
    }

    async getLists(): Promise<List[]> {
        const rawlists = await this.api.query({
            prefix: semantics.lists(this.ccid),
            schema: Schemas.list
        })

        const Lists = await Promise.all(rawlists.map((sd) => List.loadFromSD(this, sd)))

        return Lists
    }
}
