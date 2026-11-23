import { Document, NotFoundError } from '@concrnt/client'
import { Client, InvitationSchema, List, ListSchema, PinnedListsSchema, Schemas, semantics } from '@concrnt/worldlib'

// 受け入れた招待(ゲスト閲覧中、登録完了時に適用するまで保持する)。
// domainは招待URIのhint(招待者のサーバー)で、ゲストクライアントの接続先と登録先の初期値に使う
export interface StoredInvitation {
    domain: string
    value: InvitationSchema
}

export const loadStoredInvitation = (): StoredInvitation | null => {
    const stored = localStorage.getItem('invitation')
    return stored ? JSON.parse(stored) : null
}

// 招待者のリストを直接ピンせず自分の名前空間へ複製するのは、受け手が自由に編集できるようにするため
export const applyInvitation = async (client: Client, invitation: InvitationSchema, hint: string): Promise<void> => {
    const base = Date.now()
    const pins: PinnedListsSchema = []
    for (const [i, entry] of invitation.lists.entries()) {
        // 招待を作った後で招待者がリストを消していることがある。残りのリストだけで始められるようにする
        const source = await List.load(client, entry.uri, hint).catch((err) => {
            if (err instanceof NotFoundError) return null
            throw err
        })
        if (!source) continue
        const entries = await source.entries.value()

        const uri = semantics.list(client.ccid, client.currentProfile, (base + i).toString())
        const document: Document<ListSchema> = {
            kind: 'record',
            key: uri,
            author: client.ccid,
            schema: Schemas.list,
            value: { name: source.title, iconURL: source.iconURL },
            createdAt: new Date()
        }
        await client.api.commit(document)
        const list = new List(client, uri, source.title, source.iconURL)
        for (const item of entries) {
            await list.addItem(client, item.value.href, item.value.schema)
        }
        pins.push({ uri, defaultPostHome: false, defaultPostTimelines: entry.defaultPostTimelines })
    }

    // 登録直後はピン留めドキュメントがまだ無い。ここで作ることで既定の"home"リストの自動作成も走らない
    const current = await client.api
        .getDocument<PinnedListsSchema>(semantics.lists(client.ccid, client.currentProfile), undefined, {
            cache: 'no-cache'
        })
        .then((doc) => doc.value)
        .catch((err) => {
            if (err instanceof NotFoundError) return []
            throw err
        })
    const pinnedLists: Document<PinnedListsSchema> = {
        kind: 'record',
        key: semantics.lists(client.ccid, client.currentProfile),
        author: client.ccid,
        schema: Schemas.pinnedLists,
        value: [...current, ...pins],
        createdAt: new Date()
    }
    await client.api.commit(pinnedLists)
    await client.pinnedLists.refresh()
}
