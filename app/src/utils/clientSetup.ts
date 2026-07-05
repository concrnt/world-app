import { Document, NotFoundError, Policy } from '@concrnt/client'
import { Client, Schemas, semantics } from '@concrnt/worldlib'

const ensureTimeline = async (client: Client, key: string, policy?: Policy): Promise<void> => {
    await client.api.getDocument(key).catch(async (err) => {
        if (err instanceof NotFoundError) {
            console.log(`Timeline ${key} not found, creating a new one...`)
            const document: Document<any> = {
                kind: 'record',
                key,
                author: client.ccid,
                schema: Schemas.userTimeline,
                value: {},
                createdAt: new Date(),
                policy
            }
            await client.api.commit(document)
            return document
        }
        throw err
    })
}

// ホーム・通知・アクティビティタイムラインが存在しなければ作成する
export const setupDefaultTimelines = async (client: Client): Promise<void> => {
    const ccid = client.ccid
    if (ccid === '') return
    const profile = client.currentProfile

    await Promise.all([
        ensureTimeline(client, semantics.homeTimeline(ccid, profile)),
        ensureTimeline(client, semantics.notificationTimeline(ccid, profile), {
            entries: [
                {
                    url: 'https://policy.concrnt.world/t/restrict-readers.json',
                    params: {
                        entities: [ccid]
                    }
                },
                {
                    url: 'https://policy.concrnt.world/t/write-public.json'
                }
            ]
        }),
        ensureTimeline(client, semantics.activityTimeline(ccid, profile))
    ])
}
