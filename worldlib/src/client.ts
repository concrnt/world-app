import {
    Api,
    type FQDN,
    MasterKeyAuthProvider,
    InMemoryKVS,
    KVS
} from '@concrnt/client'

export class Client {

    api: Api

    constructor(api: Api) {
        this.api = api
    }

    static async create(
        privatekey: string,
        host: FQDN,
    ): Promise<Client> {

        const authProvider = new MasterKeyAuthProvider(privatekey, host)
        let cacheEngine: KVS | undefined = new InMemoryKVS()

        const api = new Api(authProvider, cacheEngine)
        return new Client(api)

    }
}

