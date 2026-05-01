import { type FQDN, CCID, Entity, Document } from '@concrnt/client'
import { ProfileSchema } from './schemas/'
import { Client } from './client'
import { semantics } from './semantics'
import { CachedPromise } from './cachedPromise'

export class User {
    client: Client
    domain: FQDN
    profile: Partial<ProfileSchema>

    ccid: CCID
    alias?: string

    stats = new CachedPromise<{ acknowledging: number; acknowledged: number }>(async () => {
        const acknowledging = await this.client.api.requestConcrntApi<Record<string, number>>(
            this.client.server.domain,
            'net.concrnt.core.acknowledge-counts',
            {
                from: this.ccid
            }
        )
        const acknowledged = await this.client.api.requestConcrntApi<Record<string, number>>(
            this.client.server.domain,
            'net.concrnt.core.acknowledge-counts',
            {
                to: this.ccid
            }
        )
        return {
            acknowledging: acknowledging['world.concrnt.ack'] ?? 0,
            acknowledged: acknowledged['world.concrnt.ack'] ?? 0
        }
    })

    constructor(client: Client, domain: FQDN, entity: Document<Entity>, profile?: ProfileSchema) {
        this.client = client
        this.domain = domain
        this.profile = profile || {}
        this.ccid = entity.author
        this.alias = entity.value.alias
    }

    static async load(client: Client, id: CCID, hint?: string): Promise<User> {
        const entity = await client.api.getEntity(id, hint).catch((_e) => {
            throw new Error('entity not found')
        })

        const profile = await client.api
            .getDocument<ProfileSchema>(semantics.profile(entity.author, 'main'))
            .catch((_e) => {
                // ignore error, profile is optional
                return undefined
            })

        return new User(client, entity.value.domain, entity, profile?.value)
    }
}
