import { Document } from '@concrnt/client'
import { Schemas } from './schemas'
import { LikeAssociationSchema } from './schemas/'
import { User } from './user'
import { Client } from './client'
import { Association } from './association'
import { semantics } from './semantics'

export class Message<T> implements Document<T> {
    uri: string
    key?: string
    schema: string
    value: T
    author: string
    createdAt: Date
    distributes?: string[]

    hint?: string

    authorUser?: User

    associations: Array<Association<any>> = []
    ownAssociations: Array<Association<any>> = []

    associationCounts?: Record<string, number>
    reactionCounts?: Record<string, number>

    associationTarget?: Message<any> | null

    constructor(uri: string, document: Document<T>) {
        this.uri = uri
        this.key = document.key
        this.schema = document.schema
        this.value = document.value
        this.author = document.author
        this.createdAt = new Date(document.createdAt)
        this.distributes = document.distributes
    }

    static async load<T>(client: Client, uri: string, hint?: string): Promise<Message<T> | null> {
        const res = await client.api.getDocument<T>(uri, hint)
        if (!res) {
            return null
        }
        const message = new Message<T>(uri, res)
        message.hint = hint
        message.authorUser = await User.load(client, message.author, hint).catch(() => undefined)

        message.ownAssociations = (await client.api.getAssociations(uri, { author: client.ccid })).map((sd) =>
            Association.fromSignedDocument(sd)
        )

        message.associationCounts = await client.api.getAssociationCounts(uri)
        message.reactionCounts = await client.api.getAssociationCounts(uri, Schemas.reactionAssociation)

        if (res.associate) {
            message.associationTarget = await Message.load<any>(client, res.associate).catch(() => undefined)
        }

        return message
    }

    async favorite(client: Client): Promise<void> {
        const authorDomain = await client.api.getEntity(this.author, this.hint).then((user) => user?.value.domain)
        console.log('fav author domain', authorDomain)

        const distributes = [semantics.activityTimeline(client.ccid), semantics.notificationTimeline(this.author)]

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
