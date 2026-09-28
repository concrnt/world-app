import { ChunklineItem, Document, Entity } from '@concrnt/client'
import { Association, Client, Message, ProfileSchema, Schemas, User } from '@concrnt/worldlib'
import type { WrappedNotification } from '../components/NotificationTimeline'

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
const notificationSnapshotKey = (client: Client): string =>
    `notification-snapshot:${client.ccid}:${client.currentProfile}`

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

// 通知欄(NotificationTimeline)の起動時スナップショット。投稿列と違い通知は集約した表示単位(行)で描かれるので、
// 生のタイムライン項目ではなく表示中の行(種類・構成する通知のuri)をそのまま保存し、復元時は再集約せずに行へ戻す。
// 1行あたり80px程度なので、画面が埋まる分(縦長のデスクトップでも足りる程度)だけ持つ
interface NotificationSnapshotRowRaw {
    key: string
    type: WrappedNotification['type']
    uris: string[]
    href?: string
    source?: string
}

interface NotificationSnapshotRaw {
    prefix: string
    query: any
    rows: NotificationSnapshotRowRaw[]
    // uri → 通知(association/投稿)。normal行のリプライ/リルート先(ネストして描かれる)も同梱する
    messages: Record<string, MessageSnapshotRaw>
}

// 復元形。NotificationTimelineのinitialTimelineに渡す(prefix/queryが一致するときだけ使われる)
export interface NotificationSnapshot {
    prefix: string
    query: any
    rows: WrappedNotification[]
    messages: Map<string, Message<any>>
}

const NOTIFICATION_SNAPSHOT_ROWS = 20

// KVSから読んで復元する(TTLは見ない。無ければnull)
export async function loadNotificationSnapshot(client: Client): Promise<NotificationSnapshot | null> {
    const entry = await client.api.cache.get<NotificationSnapshotRaw>(notificationSnapshotKey(client))
    if (!entry?.data) return null
    const messages = new Map<string, Message<any>>()
    for (const [uri, m] of Object.entries(entry.data.messages)) {
        messages.set(uri, fromRaw(client, m))
    }
    const rows: WrappedNotification[] = []
    for (const row of entry.data.rows) {
        const items = row.uris.map((uri) => messages.get(uri)).filter((m) => m !== undefined)
        if (items.length === 0) continue
        rows.push({ key: row.key, type: row.type, items, href: row.href, source: row.source })
    }
    return { prefix: entry.data.prefix, query: entry.data.query, rows, messages }
}

// 表示中の行列から保存形を組み立ててKVSへ書く。行が持つMessageはgetMessage(通常キャッシュ)の解決値そのもの
export async function saveNotificationSnapshot(
    client: Client,
    prefix: string,
    query: any,
    rows: WrappedNotification[]
): Promise<void> {
    const head = rows.slice(0, NOTIFICATION_SNAPSHOT_ROWS)
    const messages: Record<string, MessageSnapshotRaw> = {}

    // normal行(リプライ/リルート/メンションのassociation)はMessageContainerがネストして描く
    // (association → 本文の投稿 → その返信先)ので、投稿列より1段深くまで同梱する
    const collect = async (uri: string, hint: string | undefined, depth: number): Promise<void> => {
        if (messages[uri]) return
        const message = await client.getMessage<any>(uri, hint).catch(() => null)
        if (!message) return
        messages[uri] = toRaw(message)
        if (depth <= 0) return
        // 各コンポーネントがネストのMessageContainerに渡すuri/hintと同じ組で持つ
        // (リルートassociationは元投稿をassociationTargetから描くのでネストしない)
        let nested: unknown
        switch (message.schema) {
            case Schemas.replyMessage:
            case Schemas.rerouteMessage:
            case Schemas.replyAssociation:
                nested = message.value?.targetURI
                break
            case Schemas.mentionAssociation:
                nested = message.associate
                break
        }
        if (typeof nested === 'string') {
            await collect(nested, message.authorUser?.domain ?? message.hint, depth - 1)
        }
    }

    await Promise.allSettled(
        head.map(async (row) => {
            if (row.type === 'normal' && row.href) {
                await collect(row.href, row.source ? new URL(row.source).hostname : undefined, NESTED_DEPTH + 1)
                return
            }
            for (const item of row.items) {
                if (!messages[item.uri]) messages[item.uri] = toRaw(item)
            }
        })
    )

    const raw: NotificationSnapshotRaw = {
        prefix,
        query,
        rows: head.map((row) => ({
            key: row.key,
            type: row.type,
            uris: row.items.map((item) => item.uri),
            href: row.href,
            source: row.source
        })),
        messages
    }
    await client.api.cache.set(notificationSnapshotKey(client), raw)
}
