import {
    Api,
    type FQDN,
    MasterKeyAuthProvider,
    InMemoryKVS,
    TimelineReader,
    Document,
    CCID,
    Entity
} from '@concrnt/client'
import { ProfileSchema } from './schemas/'

export class Client {
    api: Api
    ccid: string

    constructor(api: Api) {
        this.api = api
        this.ccid = ''
    }

    static async create(privatekey: string, host: FQDN): Promise<Client> {
        const authProvider = new MasterKeyAuthProvider(privatekey, host)
        const cacheEngine = new InMemoryKVS()

        const api = new Api(authProvider, cacheEngine)
        const client = new Client(api)

        client.ccid = authProvider.getCCID()

        await api
            .getResource(null, `cc://${api.authProvider.getCCID()}/world.concrnt.t-home`)
            .then((res) => {
                if (res === null) {
                    const document = {
                        key: 'world.concrnt.t-home',
                        author: api.authProvider.getCCID(),
                        schema: 'https://schema.concrnt.world/t/empty.json',
                        contentType: 'application/chunkline+json',
                        value: {},
                        createdAt: new Date()
                    }
                    api.commit(document)
                    return document
                }
                return res
            })
            .catch((err) => {
                console.error('Error fetching timeline:', err)
                return null
            })

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
        const res = await client.api.getResource<Document<T>>(null, uri, hint)
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

        const profile = await client.api.getResource<Document<ProfileSchema>>(
            null,
            `cc://${entity.ccid}/world.concrnt.profile`
        )

        return new User(entity.domain, entity, profile?.value)
    }
}
