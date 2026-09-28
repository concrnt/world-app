import { ChunklineItem, Document, Entity } from '@concrnt/client'
import { Association, Client, Message, ProfileSchema, Schemas, User } from '@concrnt/worldlib'

// Home先頭リストの「表示中の投稿列」を、起動直後に本物の先頭ページが届くまでの間だけ表示するための保存形。
// 通信はせずKVS(IndexedDB)に置くだけのアプリ都合のキャッシュなので、worldlibではなくアプリ側に持つ。
// messageCache/KVSの通常キャッシュ(Message.load等)とは独立に扱い、復元したMessageは通常キャッシュへ流し込まない。
// 表示に必要な hydration(作者プロフィール・カウント・自分のassociation)まで丸ごと持つので0往復で描ける
interface MessageSnapshotRaw {
    uri: string
    hint?: string
    document: Document<any>
    authorUser?: { ccid: string; alias?: string; domain: string; profile: Partial<ProfileSchema> }
    authorProfile: ProfileSchema
    authorProfileName: string | null
    ownAssociations: Array<ReturnType<Association<any>['toJSON']>>
    associationCounts?: Record<string, number>
    reactionCounts?: Record<string, number>
    associationTarget?: MessageSnapshotRaw | null
}

interface TimelineSnapshotRaw {
    timelines: string[]
    items: ChunklineItem[]
    // uri → 投稿。タイムライン項目本体に加え、リプライ/リルート先(ネストして描かれる)も同梱する
    messages: Record<string, MessageSnapshotRaw>
}

// 復元形。RealtimeTimelineのinitialTimelineに渡す(timelinesが一致するときだけ使われる)
export interface TimelineSnapshot {
    timelines: string[]
    items: ChunklineItem[]
    messages: Map<string, Message<any>>
}

// 先頭ページと同じ件数だけ保存する
const SNAPSHOT_LENGTH = 16
// リルート先がリプライだった場合にその先まで(ReplyMessage/RerouteMessageがネストで描く深さ)
const NESTED_DEPTH = 2

// webはKVSが全アカウント共有なのでccidを含める。リストはプロフィール別なのでプロフィールも含める
const snapshotKey = (client: Client): string => `timeline-snapshot:${client.ccid}:${client.currentProfile}`

const toRaw = (message: Message<any>): MessageSnapshotRaw => ({
    uri: message.uri,
    hint: message.hint,
    document: message.toJSON(),
    authorUser: message.authorUser?.toJSON(),
    authorProfile: message.authorProfile,
    authorProfileName: message.authorProfileName,
    ownAssociations: message.ownAssociations.map((a) => a.toJSON()),
    associationCounts: message.associationCounts,
    reactionCounts: message.reactionCounts,
    associationTarget:
        message.associationTarget === undefined
            ? undefined
            : message.associationTarget === null
              ? null
              : toRaw(message.associationTarget)
})

const fromRaw = (client: Client, raw: MessageSnapshotRaw): Message<any> => {
    const message = new Message<any>(raw.uri, raw.document)
    message.hint = raw.hint
    if (raw.authorUser) {
        const entity = {
            author: raw.authorUser.ccid,
            value: { alias: raw.authorUser.alias, domain: raw.authorUser.domain }
        } as unknown as Document<Entity>
        message.authorUser = new User(client, raw.authorUser.domain, entity, raw.authorUser.profile as ProfileSchema)
    }
    message.authorProfile = raw.authorProfile
    message.authorProfileName = raw.authorProfileName
    message.ownAssociations = raw.ownAssociations.map(
        (a) => new Association<any>(a.ccfs, { ...a, createdAt: new Date(a.createdAt) })
    )
    message.associationCounts = raw.associationCounts
    message.reactionCounts = raw.reactionCounts
    if (raw.associationTarget === null) {
        message.associationTarget = null
    } else if (raw.associationTarget !== undefined) {
        message.associationTarget = fromRaw(client, raw.associationTarget)
    }
    return message
}

// KVSから読んで復元する(TTLは見ない。無ければnull)
export async function loadTimelineSnapshot(client: Client): Promise<TimelineSnapshot | null> {
    const entry = await client.api.cache.get<TimelineSnapshotRaw>(snapshotKey(client))
    if (!entry?.data) return null
    const messages = new Map<string, Message<any>>()
    for (const [uri, m] of Object.entries(entry.data.messages)) {
        messages.set(uri, fromRaw(client, m))
    }
    return {
        timelines: entry.data.timelines,
        // IDBはstructured cloneでDateを保つが、保存経路によらず扱えるよう正規化しておく
        items: entry.data.items.map((item) => ({ ...item, timestamp: new Date(item.timestamp) })),
        messages
    }
}

// 表示中の項目列から保存形を組み立ててKVSへ書く。投稿本体はgetMessage(通常キャッシュ)の解決値をそのまま写す
export async function saveTimelineSnapshot(client: Client, timelines: string[], items: ChunklineItem[]): Promise<void> {
    const head = items.slice(0, SNAPSHOT_LENGTH)
    const messages: Record<string, MessageSnapshotRaw> = {}

    const collect = async (uri: string, hint: string | undefined, depth: number): Promise<void> => {
        if (messages[uri]) return
        const message = await client.getMessage<any>(uri, hint).catch(() => null)
        if (!message) return
        messages[uri] = toRaw(message)
        if (depth <= 0) return
        if (message.schema === Schemas.replyMessage || message.schema === Schemas.rerouteMessage) {
            // ReplyMessage/RerouteMessageがネストのMessageContainerに渡すuri/hintと同じ組で持つ
            const targetURI = message.value?.targetURI
            if (typeof targetURI === 'string') {
                await collect(targetURI, message.authorUser?.domain ?? message.hint, depth - 1)
            }
        }
    }

    await Promise.allSettled(
        head.map((item) =>
            item.href
                ? collect(item.href, item.source ? new URL(item.source).hostname : undefined, NESTED_DEPTH)
                : undefined
        )
    )

    const raw: TimelineSnapshotRaw = {
        timelines,
        items: head.map((item) => ({
            href: item.href,
            timestamp: item.timestamp,
            contentType: item.contentType,
            source: item.source,
            content: item.content
        })),
        messages
    }
    await client.api.cache.set(snapshotKey(client), raw)
}
