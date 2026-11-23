import { Document, NotFoundError } from '@concrnt/client'
import { Client, InvitationSchema, List, ListSchema, PinnedListsSchema, Schemas, semantics } from '@concrnt/worldlib'

// 受け入れた招待(ゲスト閲覧中、登録完了時に適用するまで保持する)。
// domainは招待URIのhint(招待者のサーバー)で、ゲストクライアントの接続先と登録先の初期値に使う
export interface StoredInvitation {
    domain: string
    inviter: string
    value: InvitationSchema
}

export const loadStoredInvitation = (): StoredInvitation | null => {
    const stored = localStorage.getItem('invitation')
    return stored ? JSON.parse(stored) : null
}

// 招待者をフォローし、招待のタイムラインと招待者のホーム(watch)を入れたリストを自分の名前空間に作って、
// 招待のデフォルト投稿先を付けてピンする
export const applyInvitation = async (client: Client, invitation: StoredInvitation, name: string): Promise<void> => {
    await client.Acknowledge(invitation.inviter)

    const uri = semantics.list(client.ccid, client.currentProfile, Date.now().toString())
    const document: Document<ListSchema> = {
        kind: 'record',
        key: uri,
        author: client.ccid,
        schema: Schemas.list,
        value: { name },
        createdAt: new Date()
    }
    await client.api.commit(document)
    const list = new List(client, uri, name)
    for (const timeline of new Set([
        ...invitation.value.timelines,
        semantics.homeTimeline(invitation.inviter, 'main')
    ])) {
        await list.addItem(client, timeline)
    }

    // 登録直後はピン留めドキュメントがまだ無い。ここで作ることで既定の"home"リストの自動作成は走らず、
    // このリストがそのままホームになる
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
        value: [
            ...current,
            { uri, defaultPostHome: current.length === 0, defaultPostTimelines: invitation.value.defaultPostTimelines }
        ],
        createdAt: new Date()
    }
    await client.api.commit(pinnedLists)
    await client.pinnedLists.refresh()
}
