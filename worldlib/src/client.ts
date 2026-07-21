import {
    Api,
    type FQDN,
    TimelineReader,
    QueryTimelineReader,
    Document,
    CCID,
    Server,
    NotFoundError,
    Socket,
    AuthProvider,
    KVS,
    SignedDocument,
    Acknowledge,
    Entity,
    InMemoryAuthProvider,
    InMemoryKVS
} from '@concrnt/client'
import { ListSchema, PinnedListsSchema, ProfileSchema, ReadAccessRequestAssociationSchema } from './schemas/'
import { User } from './user'
import { List } from './list'
import { Message } from './message'
import { Association } from './association'
import { Timeline } from './timeline'
import { semantics } from './semantics'
import { Schemas } from './schemas'
import { CachedPromise } from './cachedPromise'

const cacheLifetime = 5 * 60 * 1000
interface Cache<T> {
    data: T
    expire: number
}

export type PinnedListItem = PinnedListsSchema[number]

export class PinnedListItemClass implements PinnedListItem {
    client: Client
    uri: string
    defaultPostHome: boolean
    defaultPostTimelines: string[]
    defaultProfile?: string
    excludeSelf?: boolean

    list = new CachedPromise<List | null>(async () => {
        const list = await this.client.getList(this.uri)
        if (!list) {
            return null
        }
        return list
    })

    constructor(client: Client, item: PinnedListItem) {
        this.client = client
        this.uri = item.uri
        this.defaultPostHome = item.defaultPostHome
        this.defaultPostTimelines = item.defaultPostTimelines
        this.defaultProfile = item.defaultProfile
        this.excludeSelf = item.excludeSelf
    }
}

export class Client {
    api: Api
    ccid: string

    entity: Entity
    server: Server

    currentProfile: string

    sockets: Record<string, Socket> = {}

    messageCache: Record<string, Cache<Promise<Message<any> | null>>> = {}

    knownCommunities = new CachedPromise<Timeline[]>(async () => {
        const results = await this.api.query(
            {
                prefix: semantics.lists(this.ccid, this.currentProfile) + '/',
                schema: Schemas.communityTimeline,
                limit: 100
            },
            undefined,
            { cache: true }
        )

        const timelines = await Promise.allSettled(
            Array.from(results.values()).map((sd) => Timeline.loadFromReferenceSD(this, sd))
        )

        const uniqueResults = new Map<string, Timeline>()
        for (const r of timelines) {
            if (r.status === 'fulfilled' && r.value) {
                uniqueResults.set(r.value.uri, r.value)
            }
        }

        return Array.from(uniqueResults.values())
    })

    acknowledging = new CachedPromise<Document<Acknowledge>[]>(async () => {
        return this.getAcknowledging(this.ccid)
    })

    acknowledgingUsers = new CachedPromise<User[]>(async () => {
        const acks = await this.getAcknowledging(this.ccid)
        const users = await Promise.all(acks.map((ack) => this.getUser(ack.associate!)))
        return users.filter((u): u is User => u !== null)
    })

    acknowledgers = new CachedPromise<Document<Acknowledge>[]>(async () => {
        return this.getAcknowledgers(this.ccid)
    })

    blocks = new CachedPromise<string[]>(async () => {
        const prefix = semantics.blocks(this.ccid) + '/'
        const results = await this.api.query(
            {
                prefix: prefix,
                limit: 100
            },
            undefined,
            { cache: true }
        )
        return results.map((sd) => sd.cckv.substring(prefix.length))
    })

    pinnedLists = new CachedPromise<PinnedListItemClass[]>(async () => {
        const uri = semantics.lists(this.ccid, this.currentProfile)
        const item = await this.api
            .getDocument<PinnedListsSchema>(uri)
            .then((doc) => doc.value) // TODO: home timelineが消されていたら復元する
            .catch(async (err) => {
                if (err instanceof NotFoundError) {
                    // listから1つ選ぶ
                    let key = ''
                    const existingList = await this.api
                        .query(
                            {
                                prefix: semantics.lists(this.ccid, this.currentProfile) + '/',
                                schema: Schemas.list,
                                limit: 1
                            },
                            undefined,
                            { cache: true }
                        )
                        .catch(() => [])

                    if (existingList.length > 0) {
                        key = existingList[0].cckv
                    } else {
                        key = semantics.list(this.ccid, this.currentProfile, Date.now().toString())
                        const document: Document<ListSchema> = {
                            kind: 'record',
                            key: key,
                            schema: Schemas.list,
                            value: {
                                name: 'home'
                            },
                            author: this.ccid,
                            createdAt: new Date()
                        }

                        await this.api.commit(document)
                    }

                    const initial = [
                        {
                            uri: key,
                            defaultPostHome: true,
                            defaultPostTimelines: []
                        }
                    ]
                    const document: Document<PinnedListsSchema> = {
                        kind: 'record',
                        key: uri,
                        author: this.ccid,
                        schema: Schemas.pinnedLists,
                        value: initial,
                        createdAt: new Date()
                    }
                    this.api.commit(document)
                    return initial
                } else {
                    throw err
                }
            })

        return item.map((i) => new PinnedListItemClass(this, i))
    })

    profiles: Record<string, Document<ProfileSchema>> = {}
    get profile(): ProfileSchema {
        return (
            this.profiles[this.currentProfile]?.value ?? {
                username: 'Anonymous'
            }
        )
    }

    get profileDocument(): Document<ProfileSchema> | null {
        return this.profiles[this.currentProfile] ?? null
    }

    // =====================================================================

    // 自ドメインのオンライン状態。falseの間は読み取り専用モード相当
    isOnline: boolean = true
    private onlineSubscriptions: Array<(online: boolean) => void> = []
    private recoveryTimer: ReturnType<typeof setInterval> | null = null

    constructor(api: Api, ccid: string, entity: Entity, server: Server, profile?: string) {
        this.api = api
        this.ccid = ccid
        this.entity = entity
        this.server = server
        this.currentProfile = profile ?? 'main'

        this.api.onResourceUpdated = (uri) => {
            delete this.messageCache[uri]
        }

        this.api.onHostOnlineStatusChanged = (host, online) => {
            // Api側の簿記は接続ホスト(defaultHost)をキーにしているため、
            // server.domain(well-knownドキュメントの自己申告値)ではなくdefaultHostと比較する
            if (host !== this.api.defaultHost) return
            this.setOnlineStatus(online)
        }
    }

    private setOnlineStatus(online: boolean) {
        if (this.isOnline === online) return
        this.isOnline = online
        if (online) {
            this.stopRecoveryPoll()
        } else {
            this.startRecoveryPoll()
        }
        for (const callback of this.onlineSubscriptions) {
            callback(online)
        }
    }

    subscribeOnlineStatus(callback: (online: boolean) => void) {
        this.onlineSubscriptions.push(callback)
    }

    unsubscribeOnlineStatus(callback: (online: boolean) => void) {
        this.onlineSubscriptions = this.onlineSubscriptions.filter((sub) => sub !== callback)
    }

    // バックオフゲートを迂回して自ドメインへ直接プローブする
    async probeDomainStatus(): Promise<boolean> {
        return await this.api.getServerOnlineStatus(this.api.defaultHost)
    }

    // 自分が利用しているsubkeyがサーバー上でまだenact状態か確認する。
    // サーバー側リセットや他デバイスからのrevokeで無効化されているケースを検知するために起動時に呼ばれる。
    // 'unknown'はオフライン等でチェックできなかったことを表し、fail-openとして扱う(誤って無効判定しない)
    async checkSubkeyStatus(): Promise<'valid' | 'invalid' | 'unknown'> {
        const ckid = this.api.authProvider.getCKID()
        if (!ckid) return 'valid' // subkeyを使っていないセッション(マスターキーのみ)は対象外

        try {
            const doc = await this.api.getDocument(semantics.subkey(this.ccid, ckid), undefined, {
                cache: 'no-cache'
            })
            // revoked-subkey.jsonによる同一キー上書き(CIP-13)もrevoke扱い
            return doc.kind === 'record' && doc.schema === 'https://schema.concrnt.net/subkey.json'
                ? 'valid'
                : 'invalid'
        } catch (err) {
            if (err instanceof NotFoundError) return 'invalid'
            return 'unknown'
        }
    }

    startRecoveryPoll() {
        if (this.recoveryTimer) return
        this.recoveryTimer = setInterval(() => {
            this.probeDomainStatus()
        }, 30 * 1000)
    }

    private stopRecoveryPoll() {
        if (this.recoveryTimer) {
            clearInterval(this.recoveryTimer)
            this.recoveryTimer = null
        }
    }

    dispose() {
        this.stopRecoveryPoll()
        this.onlineSubscriptions = []
        for (const socket of Object.values(this.sockets)) {
            socket.dispose()
        }
        this.sockets = {}
    }

    static async create(
        host: FQDN,
        authProvider: AuthProvider,
        cacheEngine: KVS,
        profile: string = 'main'
    ): Promise<Client> {
        const api = new Api(host, authProvider, cacheEngine)

        // 自ドメインへ直接プローブ。オフラインでも以降はキャッシュから構築を試みる
        const online = await api.getServerOnlineStatus(host)
        if (!online) {
            console.error(`server ${host} is offline. attempting to boot from cache...`)
        }

        // オフライン時はキャッシュがあればそこから返る。なければServerOfflineErrorが伝播する
        const server = await api.getServer(host)
        const ccid = authProvider.getCCID()

        const entity = await api.getEntity(ccid)

        // 各種タイムラインの作成やリストの読み込みなどの初期化はアプリケーション側の責務
        const client = new Client(api, ccid, entity.value, server, profile)
        if (!online) {
            client.isOnline = false
            client.startRecoveryPoll()
        }
        return client
    }

    // 鍵を持たないゲスト(未ログイン)用クライアント。公開リソースの閲覧のみ可能で、署名を伴う操作は行えない
    static async createAsGuest(host: FQDN, cacheEngine?: KVS): Promise<Client> {
        const api = new Api(host, new InMemoryAuthProvider(), cacheEngine ?? new InMemoryKVS())

        const online = await api.getServerOnlineStatus(host)

        // オフラインかつキャッシュなしの場合はServerOfflineErrorが伝播する
        const server = await api.getServer(host)

        const guestEntity: Entity = { domain: server.domain, alias: '', alias_proof_type: '' }
        const client = new Client(api, '', guestEntity, server)
        if (!online) {
            client.isOnline = false
            client.startRecoveryPoll()
        }
        return client
    }

    async updateProfiles(): Promise<void> {
        await this.api
            .query(
                {
                    parent: semantics.profiles(this.ccid),
                    order: 'asc',
                    limit: 100
                },
                undefined,
                { cache: true }
            )
            .then((res) => {
                const prefixLength = semantics.profiles(this.ccid).length + 1
                for (const sd of res) {
                    const name = sd.cckv.substring(prefixLength)
                    this.profiles[name] = JSON.parse(sd.document)
                }
                console.log('Profiles updated:', this.profiles)
            })
    }

    async block(target: string): Promise<void> {
        const blockDocument = {
            kind: 'record' as const,
            key: semantics.block(this.ccid, target),
            schema: Schemas.empty,
            value: {},
            author: this.ccid,
            createdAt: new Date()
        }
        await this.api.commit(blockDocument)
        this.blocks.reload()
    }

    async unblock(target: string): Promise<void> {
        const blockUri = semantics.block(this.ccid, target)
        await this.api.delete(blockUri)
        this.blocks.reload()
    }

    async requestReadAccess(
        target: string,
        owner: string,
        notifyProfile: string = 'main'
    ): Promise<Association<ReadAccessRequestAssociationSchema>> {
        const domain = (await this.api.getEntity(owner)).value.domain
        const document: Document<ReadAccessRequestAssociationSchema> = {
            kind: 'association',
            author: this.ccid,
            schema: Schemas.readAccessRequestAssociation,
            associate: target,
            value: {},
            distributes: [semantics.notificationTimeline(owner, notifyProfile)],
            createdAt: new Date()
        }
        const sd = await this.api.commit(document, domain)
        return Association.fromSignedDocument(sd)
    }

    async getOwnReadAccessRequest(target: string): Promise<Association<ReadAccessRequestAssociationSchema> | null> {
        const sds = await this.api
            .getAssociations(target, { author: this.ccid, schema: Schemas.readAccessRequestAssociation })
            .catch(() => []) // 制限中のdocumentに対しては403になる場合がある
        if (sds.length === 0) return null
        return Association.fromSignedDocument(sds[0])
    }

    async grantReadAccess(target: string, ccid: string): Promise<void> {
        const doc = await this.api.getDocument<any>(target)
        const entry = doc.policy?.entries?.find((e) => e.url === 'https://policy.concrnt.world/t/restrict-readers.json')
        if (!entry) return // 制限が既に解除されている
        const entities: string[] = entry.params?.entities ?? []
        if (!entities.includes(ccid)) {
            entry.params = { ...entry.params, entities: [...entities, ccid] }
        }
        const newDoc: Document<any> = {
            kind: 'record',
            key: doc.key ?? target,
            schema: doc.schema,
            value: doc.value,
            author: this.ccid,
            createdAt: new Date(),
            policy: doc.policy,
            onUpdate: 'forget'
        }
        await this.api.commit(newDoc)
    }

    async newSocket(host?: string): Promise<Socket> {
        const targetHost = host ?? this.server.domain
        if (!this.sockets[targetHost]) {
            this.sockets[targetHost] = new Socket(this.api, host)
            await this.sockets[targetHost].waitOpen()
        }
        return this.sockets[targetHost]
    }

    async newTimelineReader(opts?: { withoutSocket: boolean; hostOverride?: string }): Promise<TimelineReader> {
        if (opts?.withoutSocket) {
            return new TimelineReader(this.api, undefined, opts?.hostOverride)
        }
        const socket = await this.newSocket(opts?.hostOverride)
        return new TimelineReader(this.api, socket, opts?.hostOverride)
    }

    async newQueryTimelineReader(): Promise<QueryTimelineReader> {
        return new QueryTimelineReader(this.api)
    }

    getMessage<T>(uri: string, hint?: string): Promise<Message<T> | null> {
        const cached = this.messageCache[uri]

        if (cached && cached.expire > Date.now()) {
            return cached.data
        }

        const msg = Message.load<T>(this, uri, hint)
        this.messageCache[uri] = {
            data: msg,
            expire: Date.now() + cacheLifetime
        }
        return msg
    }

    async getUser(id: CCID, hint?: string): Promise<User | null> {
        return User.load(this, id, hint).catch(() => null)
    }

    async getTimeline(uri: string, hint?: string): Promise<Timeline | null> {
        return Timeline.load(this, uri, hint).catch(() => null)
    }

    async getList(uri: string, hint?: string): Promise<List | null> {
        return List.load(this, uri, hint).catch(() => null)
    }

    async Acknowledge(to: string): Promise<void> {
        const document = {
            kind: 'ack' as const,
            author: this.ccid,
            schema: Schemas.followAck,
            value: {},
            associate: semantics.user(to),
            distributes: [
                semantics.activityTimeline(this.ccid, this.currentProfile),
                semantics.notificationTimeline(to, 'main')
            ],
            createdAt: new Date()
        }
        await this.api.commit(document)

        this.acknowledging.reload()
        this.acknowledgingUsers.reload()
    }

    async UnAcknowledge(to: string): Promise<void> {
        const document = {
            kind: 'unack' as const,
            author: this.ccid,
            schema: Schemas.followAck,
            value: {},
            associate: semantics.user(to),
            createdAt: new Date()
        }
        await this.api.commit(document)
        this.acknowledging.reload()
        this.acknowledgingUsers.reload()
    }

    getAcknowledging(ccid: string): Promise<Document<Acknowledge>[]> {
        return this.api
            .requestConcrntApi<Array<SignedDocument>>(this.server.domain, 'net.concrnt.core.acknowledges', {
                from: ccid,
                schema: Schemas.followAck
            })
            .then((res) => res.map((sd) => JSON.parse(sd.document)))
    }

    async getAcknowledgers(ccid: string): Promise<Document<Acknowledge>[]> {
        return this.api
            .requestConcrntApi<Array<SignedDocument>>(this.server.domain, 'net.concrnt.core.acknowledges', {
                to: ccid,
                schema: Schemas.followAck
            })
            .then((res) => res.map((sd) => JSON.parse(sd.document)))
    }

    async getLists(): Promise<List[]> {
        const rawlists = await this.api.query({
            prefix: semantics.lists(this.ccid, this.currentProfile),
            schema: Schemas.list,
            limit: 100
        })

        const Lists = await Promise.all(rawlists.map((sd) => List.loadFromSD(this, sd)))

        return Lists
    }

    async deleteList(uri: string): Promise<void> {
        // 末尾*のrange削除でリスト本体と子要素(参照レコード)をまとめて消す。
        // サーバー側で全対象のpolicyが通った場合のみアトミックに削除される
        await this.api.delete(uri + '*')

        const pinned = await this.pinnedLists.value()
        if (pinned.some((item) => item.uri === uri)) {
            await this.removePin(uri)
        }
        this.knownCommunities.reload()
    }

    async removePin(uri: string): Promise<void> {
        const latestDoc = await this.api.getDocument<PinnedListsSchema>(semantics.lists(this.ccid, this.currentProfile))
        const newValue = latestDoc.value.filter((item) => item.uri !== uri)
        const newDocument: Document<PinnedListsSchema> = {
            kind: 'record',
            key: semantics.lists(this.ccid, this.currentProfile),
            author: this.ccid,
            schema: Schemas.pinnedLists,
            value: newValue,
            createdAt: new Date()
        }

        await this.api.commit(newDocument)
        this.pinnedLists.reload()
    }

    async addPin(
        uri: string,
        options?: {
            defaultPostHome?: boolean
            defaultPostTimelines?: string[]
            defaultProfile?: string
            excludeSelf?: boolean
        }
    ): Promise<void> {
        const latestDoc = await this.api.getDocument<PinnedListsSchema>(semantics.lists(this.ccid, this.currentProfile))
        const newValue = [
            ...latestDoc.value,
            {
                uri,
                defaultPostHome: options?.defaultPostHome ?? false,
                defaultPostTimelines: options?.defaultPostTimelines ?? [],
                defaultProfile: options?.defaultProfile,
                excludeSelf: options?.excludeSelf
            }
        ]
        const newDocument: Document<PinnedListsSchema> = {
            kind: 'record',
            key: semantics.lists(this.ccid, this.currentProfile),
            author: this.ccid,
            schema: Schemas.pinnedLists,
            value: newValue,
            createdAt: new Date()
        }

        await this.api.commit(newDocument)
        this.pinnedLists.reload()
    }

    async updatePinnedList(
        uri: string,
        options: {
            defaultPostHome?: boolean
            defaultPostTimelines?: string[]
            defaultProfile?: string
            excludeSelf?: boolean
        }
    ): Promise<void> {
        const latestDoc = await this.api.getDocument<PinnedListsSchema>(semantics.lists(this.ccid, this.currentProfile))
        const newValue = latestDoc.value.map((item) => {
            if (item.uri === uri) {
                return {
                    uri,
                    defaultPostHome: options.defaultPostHome ?? item.defaultPostHome,
                    defaultPostTimelines: options.defaultPostTimelines ?? item.defaultPostTimelines,
                    defaultProfile: options.defaultProfile ?? item.defaultProfile,
                    excludeSelf: options.excludeSelf ?? item.excludeSelf
                }
            }
            return item
        })
        const newDocument: Document<PinnedListsSchema> = {
            kind: 'record',
            key: semantics.lists(this.ccid, this.currentProfile),
            author: this.ccid,
            schema: Schemas.pinnedLists,
            value: newValue,
            createdAt: new Date()
        }

        await this.api.commit(newDocument)
        this.pinnedLists.reload()
    }
}
