import { type FQDN, CCID, Entity, Document } from '@concrnt/client'
import { ProfileSchema } from './schemas/'
import { Client } from './client'

export class User {
    domain: FQDN
    profile: Partial<ProfileSchema>

    ccid: CCID
    alias?: string

    constructor(domain: FQDN, entity: Document<Entity>, profile?: ProfileSchema) {
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
            .getDocument<ProfileSchema>(`cckv://${entity.author}/concrnt.world/main/profile`)
            .catch((_e) => {
                // ignore error, profile is optional
                return undefined
            })

        return new User(entity.value.domain, entity, profile?.value)
    }

    async GetStats(client: Client): Promise<{ acknowledging: number; acknowledged: number }> {
        const acknowledging = await client.api.requestConcrntApi<Record<string, number>>(
            client.server.domain,
            'net.concrnt.core.acknowledge-counts',
            {
                from: this.ccid
            }
        )
        const acknowledged = await client.api.requestConcrntApi<Record<string, number>>(
            client.server.domain,
            'net.concrnt.core.acknowledge-counts',
            {
                to: this.ccid
            }
        )
        return {
            acknowledging: acknowledging['world.concrnt.ack'] ?? 0,
            acknowledged: acknowledged['world.concrnt.ack'] ?? 0
        }
    }
}
