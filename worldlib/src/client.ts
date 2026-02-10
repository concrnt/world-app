import {
    Api,
    type FQDN,
    MasterKeyAuthProvider,
    InMemoryKVS,
    TimelineReader,
    QueryTimelineReader,
    Document,
    CCID,
    Entity,
    Server,
    NotFoundError,
    Socket
} from '@concrnt/client'
import { Schemas } from './schemas'
import { ListSchema, ProfileSchema, CommunityTimelineSchema, LikeAssociationSchema } from './schemas/'
import { isFulfilled, isNonNull } from './util'

export class Client {
    api: Api
    ccid: string
    server: Server

    user: User | null = null
    home: List | null = null

    sockets: Record<string, Socket> = {}

    constructor(api: Api, ccid: string, server: Server) {
        this.api = api
        this.ccid = ccid
        this.server = server
    }

    static async create(privatekey: string, host: FQDN): Promise<Client> {
        const authProvider = new MasterKeyAuthProvider(privatekey, host)
        const cacheEngine = new InMemoryKVS()

        const api = new Api(authProvider, cacheEngine)

        const server = await api.getServer(host)
        const ccid = authProvider.getCCID()

        const client = new Client(api, ccid, server)

        client.user = await client.getUser(ccid).catch(() => null)

        // ==== Default kit ====
        await api.getDocument(`cckv://${api.authProvider.getCCID()}/concrnt.world/main/posts`).catch((err) => {
            if (err instanceof NotFoundError) {
                console.log('Home timeline not found, creating a new one...')
                const document = {
                    key: '/concrnt.world/main/posts',
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

        await api.getDocument(`cckv://${api.authProvider.getCCID()}/concrnt.world/main/home-timeline`).catch((err) => {
            if (err instanceof NotFoundError) {
                console.log('Home timeline not found, creating a new one...')
                const document = {
                    key: '/concrnt.world/main/home-timeline',
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

        await api
            .getDocument(`cckv://${api.authProvider.getCCID()}/concrnt.world/main/notify-timeline`)
            .catch((err) => {
                if (err instanceof NotFoundError) {
                    console.log('Notification timeline not found, creating a new one...')
                    const document = {
                        key: '/concrnt.world/main/notify-timeline',
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

        await api
            .getDocument(`cckv://${api.authProvider.getCCID()}/concrnt.world/main/activity-timeline`)
            .catch((err) => {
                if (err instanceof NotFoundError) {
                    console.log('Activity timeline not found, creating a new one...')
                    const document = {
                        key: '/concrnt.world/main/activity-timeline',
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

        client.home = await List.load(
            client,
            `cckv://${api.authProvider.getCCID()}/concrnt.world/main/home-list`
        ).catch((err) => {
            if (err instanceof NotFoundError) {
                console.log('Home list not found, creating a new one...')
                const document: Document<ListSchema> = {
                    key: '/concrnt.world/main/home-list',
                    author: api.authProvider.getCCID(),
                    schema: 'https://schema.concrnt.world/utils/list.json',
                    value: {
                        title: 'Home',
                        items: []
                    },
                    createdAt: new Date()
                }
                api.commit(document)

                return new List(
                    `cckv://${api.authProvider.getCCID()}/concrnt.world/main/home-list`,
                    document.value.title,
                    document.value.items
                )
            } else {
                throw err
            }
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

    async getMessage<T>(uri: string, hint?: string): Promise<Message<T> | null> {
        return Message.load<T>(this, uri, hint).catch(() => null)
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
}

export class Message<T> implements Document<T> {
    uri: string
    key?: string
    schema: string
    value: T
    author: string
    owner?: string
    createdAt: Date
    distributes?: string[]

    authorUser?: User

    associations: Array<Document<any>> = []
    ownAssociations: Array<Document<any>> = []

    associationCounts?: Record<string, number>
    reactionCounts?: Record<string, number>

    constructor(uri: string, document: Document<T>) {
        this.uri = uri
        this.key = document.key
        this.schema = document.schema
        this.value = document.value
        this.author = document.author
        this.owner = document.owner
        this.createdAt = document.createdAt
        this.distributes = document.distributes
    }

    static async load<T>(client: Client, uri: string, hint?: string): Promise<Message<T> | null> {
        const res = await client.api.getDocument<T>(uri, hint)
        if (!res) {
            return null
        }
        const message = new Message<T>(uri, res)
        message.authorUser = await User.load(client, message.author, hint).catch(() => undefined)

        message.ownAssociations = await client.api.getAssociations<any>(uri, { author: client.ccid })
        message.associationCounts = await client.api.getAssociationCounts(uri)
        message.reactionCounts = await client.api.getAssociationCounts(uri, Schemas.reactionAssociation)

        return message
    }

    async favorite(client: Client): Promise<void> {
        const authorDomain = await client.getUser(this.author).then((user) => user?.domain)

        const distributes = [
            `cckv://${client.ccid}/concrnt.world/main/activity-timeline`,
            `cckv://${this.author}/concrnt.world/main/notify-timeline`
        ]

        const document: Document<LikeAssociationSchema> = {
            author: client.ccid,
            schema: Schemas.likeAssociation,
            associate: this.uri,
            value: {},
            distributes,
            createdAt: new Date()
        }

        return client.api.commit(document, authorDomain)
    }
}

export class User {
    domain: FQDN
    profile: Partial<ProfileSchema>

    ccid: CCID
    alias?: string
    tag?: string
    affiliationDocument?: string
    affiliationSignature?: string

    constructor(domain: FQDN, entity: Entity, profile?: ProfileSchema) {
        this.domain = domain
        this.profile = profile || {}
        this.ccid = entity.ccid
        this.alias = entity.alias
        this.tag = entity.tag
        this.affiliationDocument = entity.affiliationDocument
        this.affiliationSignature = entity.affiliationSignature
    }

    static async load(client: Client, id: CCID, hint?: string): Promise<User> {
        const entity = await client.api.getEntity(id, hint).catch((_e) => {
            throw new Error('entity not found')
        })

        const profile = await client.api.getDocument<ProfileSchema>(`cckv://${entity.ccid}/concrnt.world/main/profile`)

        return new User(entity.domain, entity, profile?.value)
    }
}

export class List {
    uri: string

    title: string

    items: string[]
    communities: Timeline[] = []

    constructor(uri: string, title: string, items: string[]) {
        this.uri = uri
        this.title = title
        this.items = items
    }

    static async load(client: Client, uri: string, hint?: string): Promise<List | null> {
        const res = await client.api.getDocument<ListSchema>(uri, hint)
        if (!res) {
            return null
        }
        const list = new List(uri, res.value.title, res.value.items)

        const itemsQuery = await Promise.allSettled(
            res.value.items.map(async (item) => {
                return Timeline.load(client, item)
            })
        )

        const items: Timeline[] = itemsQuery
            .filter(isFulfilled)
            .map((r) => r.value)
            .filter(isNonNull)
        list.communities = items.filter((i) => i.schema === Schemas.communityTimeline)

        return list
    }

    async addItem(client: Client, item: string): Promise<void> {
        const latestDocument = await client.api.getDocument<ListSchema>(this.uri)
        if (!latestDocument) {
            throw new Error('List document not found')
        }

        if (latestDocument.value.items.includes(item)) {
            return
        }

        latestDocument.value.items.push(item)

        await client.api.commit(latestDocument)

        this.items = latestDocument.value.items
    }

    async removeItem(client: Client, item: string): Promise<void> {
        const latestDocument = await client.api.getDocument<ListSchema>(this.uri)
        if (!latestDocument) {
            throw new Error('List document not found')
        }

        latestDocument.value.items = latestDocument.value.items.filter((i) => i !== item)

        await client.api.commit(latestDocument)

        this.items = latestDocument.value.items
    }
}

export class Timeline {
    uri: string

    schema: string

    name: string
    shortname?: string
    description?: string
    icon?: string
    banner?: string

    constructor(uri: string, schema: string, value: CommunityTimelineSchema) {
        this.uri = uri
        this.schema = schema
        this.name = value.name
        this.shortname = value.shortname
        this.description = value.description
        this.icon = value.icon
        this.banner = value.banner
    }

    static async load(client: Client, uri: string, hint?: string): Promise<Timeline | null> {
        const res = await client.api.getDocument<CommunityTimelineSchema>(uri, hint)
        if (!res) {
            return null
        }
        const timeline = new Timeline(uri, res.schema, res.value)

        return timeline
    }
}
