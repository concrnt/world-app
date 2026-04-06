import { type FQDN, CCID, Entity } from '@concrnt/client'
import { ProfileSchema } from './schemas/'
import { Client } from './client'

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

    async GetStats(client: Client): Promise<{ acknowledging: number; acknowledged: number }> {
        const acknowledging = await client.api.requestConcrntApi<{ count: number }>(
            client.server.domain,
            'net.concrnt.core.acknowledge-counts',
            {
                from: this.ccid
            }
        )
        console.log('acknowledging', acknowledging)
        const acknowledged = await client.api.requestConcrntApi<{ count: number }>(
            client.server.domain,
            'net.concrnt.core.acknowledged-counts',
            {
                to: this.ccid
            }
        )
        console.log('acknowledged', acknowledged)
        return {
            acknowledging: acknowledging.count,
            acknowledged: acknowledged.count
        }
    }
}
