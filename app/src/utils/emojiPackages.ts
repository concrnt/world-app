import type { Document } from '@concrnt/client'
import { Client, List, type ListSchema, Schemas, semantics } from '@concrnt/worldlib'

export const TWEMOJI_URL =
    'https://gist.githubusercontent.com/totegamma/6e1a047f54960f6bb7b946064664d793/raw/twemoji.json'

export const EMOJI_PACKAGE_SCHEMA = 'https://schema.concrnt.world/s/emoji-package.json'

export const ensureEmojiPackageList = async (client: Client): Promise<List> => {
    const uri = semantics.emojipacks(client.ccid)
    const existing = await client.getList(uri)

    if (existing) {
        return existing
    }

    const document: Document<ListSchema> = {
        key: uri,
        schema: Schemas.list,
        value: {
            name: 'emoji packages'
        },
        author: client.ccid,
        createdAt: new Date()
    }

    await client.api.commit(document)

    const list = new List(client, uri, document.value.name)
    // List items are stored as reference.json documents under the list key.
    await list.addItem(client, TWEMOJI_URL, EMOJI_PACKAGE_SCHEMA)

    return list
}
