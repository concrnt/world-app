import { Document } from '@concrnt/client'
import { Schemas } from './schemas'
import { LikeAssociationSchema } from './schemas/'
import { User } from './user'
import { Client } from './client'

export class Message<T> implements Document<T> {
    uri: string
    key?: string
    schema: string
    value: T
    author: string
    createdAt: Date
    distributes?: string[]

    authorUser?: User

    associations: Array<Document<any>> = []
    ownAssociations: Array<Document<any>> = []

    associationCounts?: Record<string, number>
    reactionCounts?: Record<string, number>

    associationTarget?: Message<any> | null

    constructor(uri: string, document: Document<T>) {
        this.uri = uri
        this.key = document.key
        this.schema = document.schema
        this.value = document.value
        this.author = document.author
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

        if (res.associate) {
            message.associationTarget = await Message.load<any>(client, res.associate).catch(() => undefined)
        }

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
