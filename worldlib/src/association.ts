import { Client } from './client'
import { Document, SignedDocument } from '@concrnt/client'

export class Association<T> implements Document<T> {
    ccfs: string
    schema: string
    value: T
    author: string
    createdAt: Date
    distributes: string[]
    associate: string
    associationVariant?: string

    toJSON() {
        return {
            ccfs: this.ccfs,
            schema: this.schema,
            value: this.value,
            author: this.author,
            createdAt: this.createdAt,
            distributes: this.distributes,
            associate: this.associate,
            associationVariant: this.associationVariant
        }
    }

    constructor(ccfs: string, document: Document<T>) {
        this.ccfs = ccfs
        this.schema = document.schema
        this.value = document.value
        this.author = document.author
        this.createdAt = document.createdAt
        this.distributes = document.distributes ?? []
        this.associate = document.associate!
        this.associationVariant = document.associationVariant
    }

    static fromSignedDocument(sd: SignedDocument): Association<any> {
        const document = JSON.parse(sd.document) as Document<any>
        return new Association(sd.ccfs, document)
    }

    async delete(client: Client): Promise<void> {
        return client.api.delete(this.ccfs)
    }
}
