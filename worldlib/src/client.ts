import {
    Api,
    type FQDN,
    MasterKeyAuthProvider,
    InMemoryKVS,
    KVS,
    TimelineReader,
    Document
} from '@concrnt/client'

export class Client {

    api: Api
    ccid: string

    constructor(api: Api) {
        this.api = api
        this.ccid = ''
    }

    static async create(
        privatekey: string,
        host: FQDN,
    ): Promise<Client> {

        const authProvider = new MasterKeyAuthProvider(privatekey, host)
        let cacheEngine: KVS | undefined = new InMemoryKVS()

        const api = new Api(authProvider, cacheEngine)
        const client = new Client(api)

        client.ccid = authProvider.getCCID()

        await api.getResource(null, `cc://${api.authProvider.getCCID()}/world.concrnt.t-home`)
            .then((res) => {
                if (res === null) {
                    const document = {
                        key: "world.concrnt.t-home",
                        author: api.authProvider.getCCID(),
                        schema: "https://schema.concrnt.world/t/empty.json",
                        contentType: "application/chunkline+json",
                        value: {},
                        createdAt: new Date(),
                    }
                    api.commit(document);
                    return document;
                }
                return res;
            })
            .catch((err) => {
                console.error("Error fetching timeline:", err);
                return null;
            })

        return client
    }

    async newTimelineReader(opts?: { withoutSocket: boolean; hostOverride?: string }): Promise<TimelineReader> {
        if (opts?.withoutSocket) {
            return new TimelineReader(this.api, undefined)
        }
        // const socket = await this.newSocket(opts?.hostOverride)
        return new TimelineReader(this.api/*, socket, opts?.hostOverride*/)
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
        return new Message<T>(uri, res)
    }

}

