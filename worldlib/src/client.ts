import {
    Api,
    type FQDN,
    MasterKeyAuthProvider,
    InMemoryKVS,
    TimelineReader,
    Document,
    CCID,
    Entity,
    Server,
    NotFoundError
} from '@concrnt/client'
import { Schemas } from './schemas'
import { ListSchema, ProfileSchema, CommunityTimelineSchema } from './schemas/'
import { isFulfilled, isNonNull } from './util'

export class Client {
    api: Api
    ccid: string
    server: Server

    home: List | null = null

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

        // ==== Default kit ====
        await api.getDocument(`cc://${api.authProvider.getCCID()}/concrnt.world/main/home-timeline`).catch((err) => {
            if (err instanceof NotFoundError) {
                console.log('Home timeline not found, creating a new one...')
                const document = {
                    key: '/concrnt.world/main/home-timeline',
                    author: api.authProvider.getCCID(),
                    schema: 'https://schema.concrnt.world/t/empty.json',
                    value: {},
                    createdAt: new Date()
                }
                api.commit(document)
                return document
            }
            throw err
        })

        client.home = await List.load(client, `cc://${api.authProvider.getCCID()}/concrnt.world/main/home-list`).catch(
            (err) => {
                if (err instanceof NotFoundError) {
                    console.log('Home list not found, creating a new one...')
                    const document: Document<ListSchema> = {
                        key: '/concrnt.world/main/home-list',
                        author: api.authProvider.getCCID(),
                        schema: 'https://schema.concrnt.world/utils/list.json',
                        value: {
                            title: 'Home',
                            items: [],
                            meta: {
                                defaultPostHome: true,
                                defaultPostTimelines: []
                            }
                        },
                        createdAt: new Date()
                    }
                    api.commit(document)

                    return new List(
                        `cc://${api.authProvider.getCCID()}/concrnt.world/main/home-list`,
                        document.value.title,
                        document.value.items,
                        (document.value.meta?.defaultPostHome as boolean) || false,
                        (document.value.meta?.defaultPostTimelines as string[]) || [],
                        document.value.meta?.defaultProfile as string | undefined
                    )
                } else {
                    throw err
                }
            }
        )

        // =====================

        return client
    }

    async newTimelineReader(opts?: { withoutSocket: boolean; hostOverride?: string }): Promise<TimelineReader> {
        if (opts?.withoutSocket) {
            return new TimelineReader(this.api, undefined)
        }
        // const socket = await this.newSocket(opts?.hostOverride)
        return new TimelineReader(this.api /*, socket, opts?.hostOverride*/)
    }

    async getMessage<T>(uri: string, hint?: string): Promise<Message<T> | null> {
        return Message.load<T>(this, uri, hint)
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
    memberOf?: string[]

    authorUser?: User

    constructor(uri: string, document: Document<T>) {
        this.uri = uri
        this.key = document.key
        this.schema = document.schema
        this.value = document.value
        this.author = document.author
        this.owner = document.owner
        this.createdAt = document.createdAt
        this.memberOf = document.memberOf
    }

    static async load<T>(client: Client, uri: string, hint?: string): Promise<Message<T> | null> {
        const res = await client.api.getDocument<T>(uri, hint)
        if (!res) {
            return null
        }
        const message = new Message<T>(uri, res)
        message.authorUser = await User.load(client, message.author, hint).catch(() => undefined)

        return message
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

        const profile = await client.api.getDocument<ProfileSchema>(`cc://${entity.ccid}/concrnt.world/main/profile`)

        return new User(entity.domain, entity, profile?.value)
    }
}

export class List {
    uri: string

    title: string
    defaultPostHome: boolean
    defaultPostTimelines: string[]
    defaultProfile?: string

    items: string[]
    communities: Timeline[] = []

    constructor(
        uri: string,
        title: string,
        items: string[],
        defaultPostHome: boolean,
        defaultPostTimelines: string[],
        defaultProfile?: string
    ) {
        this.uri = uri
        this.title = title
        this.items = items
        this.defaultPostHome = defaultPostHome
        this.defaultPostTimelines = defaultPostTimelines
        this.defaultProfile = defaultProfile
    }

    static async load(client: Client, uri: string, hint?: string): Promise<List | null> {
        const res = await client.api.getDocument<ListSchema>(uri, hint)
        if (!res) {
            return null
        }
        const list = new List(
            uri,
            res.value.title,
            res.value.items,
            (res.value.meta?.defaultPostHome as boolean) || false,
            (res.value.meta?.defaultPostTimelines as string[]) || [],
            res.value.meta?.defaultProfile as string | undefined
        )

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
