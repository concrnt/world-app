import { Document } from '@concrnt/client'
import { ProfileSchema } from '@concrnt/worldlib'

export const isRestrictedProfile = (document: Document<ProfileSchema>): boolean | undefined => {
    if (!document.policy) return false
    if (!document.policy.entries) return false
    if (document.policy.entries.length == 0) return false

    if (document.policy.entries.length == 1) {
        const policy = document.policy.entries[0]
        if (policy.url === 'https://policy.concrnt.world/t/restrict-readers.json') {
            return true
        } else {
            return undefined
        }
    } else {
        return undefined
    }
}
