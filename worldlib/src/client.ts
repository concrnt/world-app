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
import { ListSchema, PinnedListsSchema, ProfileSchema } from './schemas/'
import { User } from './user'
import { List } from './list'
import { Message } from './message'
import { Timeline } from './timeline'
import { semantics } from './semantics'
import { Schemas } from './schemas'
import { isFulfilled } from './util'
import { CachedPromise } from './cachedPromise'

const cacheLifetime = 5 * 60 * 1000
interface Cache<T> {
    data: T
    expire: number
}

export type PinnedListItem = PinnedListsSchema[number]

export class Client {
    api: Api
    ccid: string
    server: Server

    currentProfile: string

    sockets: Record<string, Socket> = {}

    messageCache: Record<string, Cache<Promise<Message<any> | null>>> = {}

    knownCommunities = new CachedPromise<Timeline[]>(async () => {
        const results = await this.api.query({
            prefix: semantics.lists(this.ccid, this.currentProfile),
            schema: Schemas.communityTimeline,
            limit: 100
        })
        const timelines = await Promise.allSettled(results.map((sd) => Timeline.loadFromReferenceSD(this, sd)))
        return timelines
            .filter(isFulfilled)
            .map((r) => r.value)
            .filter((t): t is Timeline => t !== null)
    })

    acknowledging = new CachedPromise<Document<Acknowledge>[]>(async () => {
        return this.getAcknowledging(this.ccid)
    })

    acknowledgers = new CachedPromise<Document<Acknowledge>[]>(async () => {
        return this.getAcknowledgers(this.ccid)
    })

    blocks = new CachedPromise<string[]>(async () => {
        const prefix = semantics.blocks(this.ccid) + '/'
        const results = await this.api.query({
            prefix: prefix,
            limit: 100
        })
        return results.map((sd) => sd.cckv.substring(prefix.length))
    })

    profiles: Record<string, Document<ProfileSchema>> = {}
    get profile(): ProfileSchema {
        return (
            this.profiles[this.currentProfile]?.value ?? {
                username: 'Anonymous'
            }
        )
    }
    pinnedLists: PinnedListItem[] = []

    // =====================================================================

    constructor(api: Api, ccid: string, server: Server, profile?: string) {
        this.api = api
        this.ccid = ccid
        this.server = server
        this.currentProfile = profile ?? 'main'

        this.api.onResourceUpdated = (uri) => {
            delete this.messageCache[uri]
        }
    }

    static async create(
        host: FQDN,
        authProvider: AuthProvider,
        cacheEngine: KVS,
        profile: string = 'main'
    ): Promise<Client> {
        const api = new Api(host, authProvider, cacheEngine)

        const server = await api.getServer(host)
        const ccid = authProvider.getCCID()

        const client = new Client(api, ccid, server, profile)
        if (ccid === '') return client

        client.updateProfiles()

        // ==== Default kit ====
        api.getDocument(semantics.homeTimeline(ccid, profile)).catch((err) => {
            if (err instanceof NotFoundError) {
                console.log('Home timeline not found, creating a new one...')
                const document = {
                    key: semantics.homeTimeline(ccid, profile),
                    author: ccid,
                    schema: Schemas.userTimeline,
                    value: {},
                    createdAt: new Date(),
                    policies: [
                        {
                            url: 'https://policy.concrnt.world/t/inline-allow-deny.json',
                            params: {
                                readListMode: false,
                                reader: [],
                                writeListMode: true,
                                writer: [ccid]
                            }
                        }
                    ]
                }
                api.commit(document)
                return document
            }
            throw err
        })

        api.getDocument(semantics.notificationTimeline(ccid, profile)).catch((err) => {
            if (err instanceof NotFoundError) {
                console.log('Notification timeline not found, creating a new one...')
                const document = {
                    key: semantics.notificationTimeline(ccid, profile),
                    author: ccid,
                    schema: Schemas.userTimeline,
                    value: {},
                    createdAt: new Date(),
                    policies: [
                        {
                            url: 'https://policy.concrnt.world/t/inline-allow-deny.json',
                            params: {
                                readListMode: true,
                                reader: [ccid],
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

        api.getDocument(semantics.activityTimeline(ccid, profile)).catch((err) => {
            if (err instanceof NotFoundError) {
                console.log('Activity timeline not found, creating a new one...')
                const document = {
                    key: semantics.activityTimeline(ccid, profile),
                    author: ccid,
                    schema: Schemas.userTimeline,
                    value: {},
                    createdAt: new Date(),
                    policies: [
                        {
                            url: 'https://policy.concrnt.world/t/inline-allow-deny.json',
                            params: {
                                readListMode: false,
                                reader: [],
                                writeListMode: true,
                                writer: [ccid]
                            }
                        }
                    ]
                }
                api.commit(document)
                return document
            }
            throw err
        })

        List.load(client, semantics.homeList(ccid, profile)).catch((err) => {
            if (err instanceof NotFoundError) {
                console.log('Home list not found, creating a new one...')
                const document: Document<ListSchema> = {
                    key: semantics.homeList(ccid, profile),
                    author: ccid,
                    schema: Schemas.list,
                    value: {
                        name: 'Home'
                    },
                    createdAt: new Date()
                }
                api.commit(document)

                return new List(semantics.homeList(ccid, profile), document.value.name)
            } else {
                throw err
            }
        })

        client.pinnedLists = await client.api
            .getDocument<PinnedListsSchema>(semantics.lists(ccid, profile))
            .then((doc) => doc.value) // TODO: home timelineが消されていたら復元する
            .catch((err) => {
                if (err instanceof NotFoundError) {
                    const initial = [
                        {
                            uri: semantics.homeTimeline(ccid, profile),
                            defaultPostHome: true,
                            defaultPostTimelines: []
                        }
                    ]
                    const document: Document<PinnedListsSchema> = {
                        key: semantics.lists(ccid, profile),
                        author: ccid,
                        schema: Schemas.pinnedLists,
                        value: initial,
                        createdAt: new Date()
                    }
                    api.commit(document)
                    return initial
                } else {
                    throw err
                }
            })

        // =====================

        return client
    }

    async updateProfiles(): Promise<void> {
        await this.api
            .query({
                parent: semantics.profiles(this.ccid),
                order: 'asc',
                limit: 100
            })
            .then((res) => {
                const prefixLength = semantics.profiles(this.ccid).length + 1
                for (const sd of res) {
                    const name = sd.cckv.substring(prefixLength)
                    this.profiles[name] = JSON.parse(sd.document)
                }
                console.log('Profiles updated:', this.profiles)
            })
    }

    async block(target: string): Promise<void> {
        const blockDocument = {
            key: semantics.block(this.ccid, target),
            schema: Schemas.empty,
            value: {},
            author: this.ccid,
            createdAt: new Date()
        }
        await this.api.commit(blockDocument)
        this.blocks.reload()
    }

    async unblock(target: string): Promise<void> {
        const blockUri = semantics.block(this.ccid, target)
        await this.api.delete(blockUri)
        this.blocks.reload()
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
        this.acknowledging.reload()
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
        this.acknowledging.reload()
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

    async getLists(): Promise<List[]> {
        const rawlists = await this.api.query({
            prefix: semantics.lists(this.ccid, this.currentProfile),
            schema: Schemas.list,
            limit: 100
        })

        const Lists = await Promise.all(rawlists.map((sd) => List.loadFromSD(this, sd)))

        return Lists
    }

    async removePin(uri: string): Promise<void> {
        const latestDoc = await this.api.getDocument<PinnedListsSchema>(semantics.lists(this.ccid, this.currentProfile))
        const newValue = latestDoc.value.filter((item) => item.uri !== uri)
        const newDocument: Document<PinnedListsSchema> = {
            key: semantics.lists(this.ccid, this.currentProfile),
            author: this.ccid,
            schema: Schemas.pinnedLists,
            value: newValue,
            createdAt: new Date()
        }

        await this.api.commit(newDocument)
        this.pinnedLists = newValue
    }

    async addPin(uri: string, options?: { defaultPostHome?: boolean; defaultPostTimelines?: string[] }): Promise<void> {
        const latestDoc = await this.api.getDocument<PinnedListsSchema>(semantics.lists(this.ccid, this.currentProfile))
        const newValue = [
            ...latestDoc.value,
            {
                uri,
                defaultPostHome: options?.defaultPostHome ?? false,
                defaultPostTimelines: options?.defaultPostTimelines ?? []
            }
        ]
        const newDocument: Document<PinnedListsSchema> = {
            key: semantics.lists(this.ccid, this.currentProfile),
            author: this.ccid,
            schema: Schemas.pinnedLists,
            value: newValue,
            createdAt: new Date()
        }

        await this.api.commit(newDocument)
        this.pinnedLists = newValue
    }

    async updatePinnedList(
        uri: string,
        options: { defaultPostHome?: boolean; defaultPostTimelines?: string[] }
    ): Promise<void> {
        const latestDoc = await this.api.getDocument<PinnedListsSchema>(semantics.lists(this.ccid, this.currentProfile))
        const newValue = latestDoc.value.map((item) => {
            if (item.uri === uri) {
                return {
                    uri,
                    defaultPostHome: options.defaultPostHome ?? item.defaultPostHome,
                    defaultPostTimelines: options.defaultPostTimelines ?? item.defaultPostTimelines
                }
            }
            return item
        })
        const newDocument: Document<PinnedListsSchema> = {
            key: semantics.lists(this.ccid, this.currentProfile),
            author: this.ccid,
            schema: Schemas.pinnedLists,
            value: newValue,
            createdAt: new Date()
        }

        await this.api.commit(newDocument)
        this.pinnedLists = newValue
    }
}
