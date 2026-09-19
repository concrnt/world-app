import { Client } from './client'
import { Document, SignedDocument } from '@concrnt/client'
import { ProfileSchema } from './schemas/'
import { semantics } from './semantics'

export class Association<T> implements Document<T> {
    ccfs: string
    kind: 'association'
    schema: string
    value: T
    author: string
    createdAt: Date
    distributes: string[]
    associate: string
    associationVariant?: string

    // 行為者が明示したサブプロフィール名(value.profileURI由来)。未指定=mainならnull
    authorProfileName: string | null

    toJSON() {
        return {
            ccfs: this.ccfs,
            kind: this.kind,
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
        this.kind = 'association'
        this.schema = document.schema
        this.value = document.value
        this.author = document.author
        this.createdAt = document.createdAt
        this.distributes = document.distributes ?? []
        this.associate = document.associate!
        this.associationVariant = document.associationVariant
        this.authorProfileName = semantics.profileNameFromURI(this.author, (document.value as any)?.profileURI) ?? null
    }

    // 行為者の表示用プロフィール。Message.loadと同じ順序で
    // mainプロフィール → profileURIのサブプロフィール → profileOverride(username/avatar) の順に重ねる
    async loadAuthorProfile(client: Client, hint?: string): Promise<ProfileSchema> {
        const user = await client.getUser(this.author, hint)
        let profile: ProfileSchema = { username: 'Anonymous', ...user?.profile }
        if (this.authorProfileName) {
            const sub = await client.api
                .getDocument<ProfileSchema>(
                    semantics.profile(this.author, this.authorProfileName),
                    user?.domain ?? hint
                )
                .then((res) => res.value)
                .catch(() => undefined)
            if (sub) {
                profile = sub
            }
        }
        const override = (this.value as any)?.profileOverride
        if (override?.username) {
            profile.username = override.username
        }
        if (override?.avatar) {
            profile.avatar = override.avatar
        }
        return profile
    }

    static fromSignedDocument(sd: SignedDocument): Association<any> {
        const document = JSON.parse(sd.document) as Document<any>
        return new Association(sd.ccfs, document)
    }

    async delete(client: Client): Promise<void> {
        return client.api.delete(this.ccfs)
    }
}
