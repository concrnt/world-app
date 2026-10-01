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
    FetchOptions,
    QueryResult,
    Acknowledge,
    Entity,
    InMemoryAuthProvider,
    InMemoryKVS,
    ServerOfflineError
} from '@concrnt/client'
import {
    ListSchema,
    PinnedListsSchema,
    ProfileSchema,
    ReadAccessRequestAssociationSchema,
    RerouteMessageSchema
} from './schemas/'
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
    isIconTab?: boolean

    list = new CachedPromise<List | null>(
        async (fresh) => {
            // getList()は失敗を全てnullに畳むため、オフライン中のrefresh()が「リストなし」をpushして
            // 表示中のタイムラインを消してしまう。存在しない場合だけnullにし、ネットワーク失敗は
            // rejectさせてrefresh()に既存値を維持させる。所有者のentity解決の404(一過性)も
            // 「リストなし」ではないので、ドメイン解決を先に済ませてそのままrejectさせる
            const owner = URL.parse(this.uri)?.host
            if (owner) await this.client.api.resolveDomain(owner)
            return await List.load(this.client, this.uri, undefined, fresh ? { cache: 'no-cache' } : undefined).catch(
                (err) => {
                    if (err instanceof NotFoundError) return null
                    throw err
                }
            )
        },
        (a, b) => JSON.stringify(a?.toJSON()) === JSON.stringify(b?.toJSON())
    )

    constructor(client: Client, item: PinnedListItem) {
        this.client = client
        this.uri = item.uri
        this.defaultPostHome = item.defaultPostHome
        this.defaultPostTimelines = item.defaultPostTimelines
        this.defaultProfile = item.defaultProfile
        this.excludeSelf = item.excludeSelf
        this.isIconTab = item.isIconTab
    }
}

// push購読と未読カウンターのvendor_id。vendorは「concrnt上のアプリケーション」単位で、
// world-appはアプリ版もweb版も同じアプリケーションなので共通の値を使う
export const PUSH_VENDOR_ID = 'world.concrnt.app'

export interface DomainStatus {
    online: boolean
    // 最後にonlineへ遷移した時刻(epoch ms)。一度も落ちていなければ0。復帰時の再試行キーとして使う
    onlineSince: number
    // 次回の自動再接続プローブ予定時刻(epoch ms)。オフラインでプローブ待機中のみ非null(プローブ実行中はnull)。
    // UIはこれを1秒ごとに読んでカウントダウンを表示する
    nextRetryAt: number | null
}

// 一度も落ちていないホストの状態。参照が安定している必要がある(useSyncExternalStoreのスナップショット比較)
export const ONLINE_STATUS: DomainStatus = Object.freeze({ online: true, onlineSince: 0, nextRetryAt: null })

export class Client {
    api: Api
    ccid: string

    entity: Entity
    server: Server

    currentProfile: string

    sockets: Record<string, Socket> = {}

    messageCache: Record<string, Cache<Promise<Message<any> | null>>> = {}
    // rerouteメッセージのuri → targetURI。invalidateMessageのカスケード用
    // (キャッシュの中身はPromiseなのでinvalidate時に同期的にrerouteか判定できない)
    private rerouteTargets: Record<string, string> = {}

    // ComposerProvider(起動時のプロバイダーツリー)が購読するため、キャッシュ即返し(裏で再取得)にする。
    // ネットワーク優先だと起動直後の全画面がこれのサスペンドで止まる
    knownCommunities = new CachedPromise<Timeline[]>(
        async (fresh) => {
            // リスト参照はcommit時点の参照先schemaでindexされる。ActivityPub inboxはcommunityTimelineから
            // apInboxTimelineへ移行したため、移行前に登録した参照はcommunity側、移行後の参照はapInbox側にしか
            // 一致しない。両方引いて合流させる
            // オフラインでキャッシュも無い初回取得は空で確定させる(rejectすると購読元のComposerProviderごと
            // 最上位のErrorBoundaryに落ちてアプリ全体がクラッシュ画面になる)。復帰時のrefresh()で埋まる。
            // refresh(fresh)の失敗はrejectさせて既存値を維持する(空をpushすると表示が消える)
            const results = (
                await Promise.all(
                    [Schemas.communityTimeline, Schemas.apInboxTimeline].map((schema) =>
                        this.api.queryAll(
                            {
                                prefix: semantics.lists(this.ccid, this.currentProfile) + '/',
                                schema
                            },
                            undefined,
                            { cache: fresh ? 'no-cache' : 'swr' }
                        )
                    )
                ).catch((err) => {
                    if (!fresh && err instanceof ServerOfflineError) return [] as SignedDocument[][]
                    throw err
                })
            ).flat()

            const timelines = await Promise.allSettled(results.map((sd) => Timeline.loadFromReferenceSD(this, sd)))

            const uniqueResults = new Map<string, Timeline>()
            for (const r of timelines) {
                if (r.status === 'fulfilled' && r.value) {
                    uniqueResults.set(r.value.uri, r.value)
                }
            }

            return Array.from(uniqueResults.values())
        },
        (a, b) => JSON.stringify(a.map((t) => t.toJSON())) === JSON.stringify(b.map((t) => t.toJSON()))
    )

    acknowledging = new CachedPromise<Document<Acknowledge>[]>(
        async () => {
            return this.getAcknowledging(this.ccid)
        },
        (a, b) => JSON.stringify(a) === JSON.stringify(b)
    )

    acknowledgingUsers = new CachedPromise<User[]>(async () => {
        const acks = await this.getAcknowledging(this.ccid)
        const users = await Promise.all(acks.map((ack) => this.getUser(ack.associate!)))
        return users.filter((u): u is User => u !== null)
    })

    acknowledgers = new CachedPromise<Document<Acknowledge>[]>(
        async () => {
            return this.getAcknowledgers(this.ccid)
        },
        (a, b) => JSON.stringify(a) === JSON.stringify(b)
    )

    // 未読通知数。サーバーが配送ごとに加算し、通知画面を開いたらresetNotificationCounter()で0に戻す。
    // 旧サーバー(エンドポイント未広告)やオフラインでは0のまま
    notificationCounter = new CachedPromise<number>(
        async () => {
            if (this.ccid === '') return 0
            const count = await this.api.getNotificationCounter(this.ccid, PUSH_VENDOR_ID).catch(() => undefined)
            return count ?? 0
        },
        (a, b) => a === b
    )

    blocks = new CachedPromise<string[]>(
        async () => {
            const prefix = semantics.blocks(this.ccid) + '/'
            const results = await this.api.queryAll(
                {
                    prefix: prefix
                },
                undefined,
                { cache: true }
            )
            return results.map((sd) => sd.cckv.substring(prefix.length))
        },
        (a, b) => JSON.stringify(a) === JSON.stringify(b)
    )

    pinnedLists = new CachedPromise<PinnedListItemClass[]>(
        async (fresh) => {
            const uri = semantics.lists(this.ccid, this.currentProfile)
            // 下のNotFoundError分岐は「listsドキュメントが無い」時だけ既定リストを作るためのもの。
            // 自分のentity解決の404(一過性のCDN 404等)まで同じ分岐に流れてリストを作り直さないよう、
            // ドメイン解決だけ先に済ませて失敗はそのままrejectさせる
            await this.api.resolveDomain(this.ccid)
            const item = await this.api
                .getDocument<PinnedListsSchema>(uri, undefined, fresh ? { cache: 'no-cache' } : undefined)
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
                            .then((res) => res.items)
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
        },
        (a, b) =>
            JSON.stringify(
                a.map((i) => [
                    i.uri,
                    i.defaultPostHome,
                    i.defaultPostTimelines,
                    i.defaultProfile,
                    i.excludeSelf,
                    i.isIconTab
                ])
            ) ===
            JSON.stringify(
                b.map((i) => [
                    i.uri,
                    i.defaultPostHome,
                    i.defaultPostTimelines,
                    i.defaultProfile,
                    i.excludeSelf,
                    i.isIconTab
                ])
            )
    )

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
    // ドメイン(ホスト)ごとのオンライン状態レジストリ。
    // 自ドメインを特別扱いせず、Apiが通信したことのある全ホストを同じ仕組みで管理する
    // (concrnt本体のclient.goのlastFailed/failCount + UpKeeperに相当)。
    // UIは「自分が必要とするドメイン」(投稿の取得先・タイムラインの購読先・プロフィールのユーザーのドメイン・
    // 投稿先の自ドメイン)の状態をuseDomainStatusで購読し、onlineSinceを復帰時の再試行キーにする

    // ホスト → 状態。値はイミュータブルに差し替える(useSyncExternalStoreのスナップショット比較のため)。
    // 復帰後もエントリは残す(onlineSinceを復帰キーとして読めるようにする)
    private domains = new Map<string, DomainStatus>()
    // 復帰プローブのタイマーと試行回数。試行回数はonline遷移で戻さない(setDomainOnline参照)
    private recovery = new Map<string, { timer: ReturnType<typeof setTimeout> | null; attempt: number }>()
    private domainSubscriptions: Array<(host: string) => void> = []
    // 再接続プローブのbackoff。末尾を上限として繰り返す
    private static readonly recoveryDelays = [500, 3000, 10000, 30000]
    // これより長くオンラインが続いていれば、次のオフラインはbackoffを最初からやり直す
    // (プローブは通るのにAPIが落ちている部分障害では復帰→再試行→失敗が数秒以内に繰り返される。
    // その場合はbackoffを引き継いで振動の周期を伸ばす)
    private static readonly stableOnlineMs = 10_000
    // オフライン等で失敗したgetMessageのエントリ(失敗ホスト → cacheKey → promise)。
    // そのホストの復帰時に破棄してErrorBoundaryの再試行で取り直させる
    private failedMessages = new Map<string, Map<string, Promise<Message<any> | null>>>()

    private profilesSubscriptions: Array<() => void> = []
    private serverSubscriptions: Array<() => void> = []
    private lastFreshResourcesRefresh = 0
    private freshResourcesPromise: Promise<void> | null = null

    constructor(api: Api, ccid: string, entity: Entity, server: Server, profile?: string) {
        this.api = api
        this.ccid = ccid
        this.entity = entity
        this.server = server
        this.currentProfile = profile ?? 'main'

        this.api.onResourceUpdated = (uri) => {
            this.invalidateMessage(uri)
        }

        // Api側の簿記はホストキー(接続先FQDN)。server.domain(well-knownの自己申告値)ではなく
        // api.defaultHostが自ドメインのキーになる
        this.api.onHostOnlineStatusChanged = (host, online) => {
            this.setDomainOnline(host, online)
        }
        // Client生成前(create/createAsGuestのプローブ、withProfileの旧インスタンス)にApiが記録した
        // オフラインホストを引き継ぐ。コールバック未設定の間の遷移通知はここで補う
        for (const host of this.api.getOfflineHosts()) {
            this.setDomainOnline(host, false)
        }
    }

    // ホストの状態。一度も落ちていなければ共有定数ONLINE_STATUSを返す
    getDomainStatus(host: string): DomainStatus {
        return this.domains.get(host) ?? ONLINE_STATUS
    }

    // 自ドメインのオンライン状態(getDomainStatus(api.defaultHost).onlineの短縮)
    get isOnline(): boolean {
        return this.getDomainStatus(this.api.defaultHost).online
    }

    // いずれかのホストのDomainStatusが変わるたびに、そのホスト名で呼ばれる(nextRetryAtの更新も含む)
    subscribeDomainStatus(callback: (host: string) => void) {
        this.domainSubscriptions.push(callback)
    }

    unsubscribeDomainStatus(callback: (host: string) => void) {
        this.domainSubscriptions = this.domainSubscriptions.filter((sub) => sub !== callback)
    }

    private emitDomainStatus(host: string) {
        for (const callback of this.domainSubscriptions) {
            callback(host)
        }
    }

    private setDomainOnline(host: string, online: boolean) {
        const prev = this.getDomainStatus(host)
        if (prev.online === online) return
        if (online) {
            this.stopRecoveryPoll(host)
            this.domains.set(host, { online: true, onlineSince: Date.now(), nextRetryAt: null })
            // 失敗キャッシュの破棄は購読者への通知より前に済ませる。通知で再試行するErrorBoundaryが
            // 同じ失敗promiseを引き直さないようにするため
            const failed = this.failedMessages.get(host)
            if (failed) {
                for (const [key, promise] of failed) {
                    if (this.messageCache[key]?.data === promise) delete this.messageCache[key]
                }
                this.failedMessages.delete(host)
            }
            if (host === this.api.defaultHost) {
                // 復帰直後のrefreshFreshResourcesが30秒抑制に引っかからないようにする
                this.lastFreshResourcesRefresh = 0
                for (const cached of this.ownCachedPromises()) {
                    cached.dropRejected(host)
                }
            }
            // このホストへのsocketは独自backoffを待たずに即再接続する(open時にTimelineReaderがcatch-upする)
            for (const socket of Object.values(this.sockets)) {
                if ((socket.hostOverride ?? this.api.defaultHost) === host) socket.reconnectNow()
            }
        } else {
            const recovery = this.recovery.get(host)
            if (recovery && Date.now() - prev.onlineSince > Client.stableOnlineMs) recovery.attempt = 0
            this.domains.set(host, { online: false, onlineSince: prev.onlineSince, nextRetryAt: null })
            this.startRecoveryPoll(host)
        }
        this.emitDomainStatus(host)
    }

    // 自ドメインに依存するClient所有のCachedPromise。復帰時にオフライン由来の失敗を破棄する対象
    private ownCachedPromises(): Array<CachedPromise<any>> {
        const own: Array<CachedPromise<any>> = [
            this.pinnedLists,
            this.knownCommunities,
            this.acknowledging,
            this.acknowledgingUsers,
            this.acknowledgers,
            this.blocks,
            this.notificationCounter
        ]
        for (const pin of this.pinnedLists.current ?? []) {
            own.push(pin.list)
            const list = pin.list.current
            if (list) own.push(list.items, list.entries)
        }
        return own
    }

    subscribeProfilesUpdated(callback: () => void) {
        this.profilesSubscriptions.push(callback)
    }

    unsubscribeProfilesUpdated(callback: () => void) {
        this.profilesSubscriptions = this.profilesSubscriptions.filter((sub) => sub !== callback)
    }

    subscribeServerUpdated(callback: () => void) {
        this.serverSubscriptions.push(callback)
    }

    unsubscribeServerUpdated(callback: () => void) {
        this.serverSubscriptions = this.serverSubscriptions.filter((sub) => sub !== callback)
    }

    // バックオフゲートを迂回してホストへ直接プローブする。結果はApiの遷移通知経由でレジストリに反映される
    async probeDomain(host: string): Promise<boolean> {
        return await this.api.getServerOnlineStatus(host)
    }

    // オフライン中の全ホストを即プローブする(アプリ復帰・ブラウザのonlineイベント用。backoff待ちをしない)
    async probeOfflineDomains(): Promise<void> {
        const offline = Array.from(this.domains.entries())
            .filter(([, status]) => !status.online)
            .map(([host]) => host)
        await Promise.allSettled(offline.map((host) => this.probeDomain(host)))
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

    private startRecoveryPoll(host: string) {
        const recovery = this.recovery.get(host) ?? { timer: null, attempt: 0 }
        this.recovery.set(host, recovery)
        if (recovery.timer) return
        this.scheduleRecoveryProbe(host)
    }

    // setIntervalではなくsetTimeoutの連鎖にして、UIが次回予定時刻(nextRetryAt)を読めるようにする。
    // プローブ成功時はmarkHostOnline→setDomainOnline(true)→stopRecoveryPollが走るので、再スケジュールは失敗時のみ
    private scheduleRecoveryProbe(host: string) {
        const recovery = this.recovery.get(host)
        if (!recovery) return
        const delays = Client.recoveryDelays
        const delay = delays[Math.min(recovery.attempt, delays.length - 1)]
        this.setNextRetryAt(host, Date.now() + delay)
        recovery.timer = setTimeout(async () => {
            recovery.timer = null
            this.setNextRetryAt(host, null)
            recovery.attempt++
            await this.probeDomain(host)
            if (!this.getDomainStatus(host).online && !recovery.timer) this.scheduleRecoveryProbe(host)
        }, delay)
    }

    // DomainStatusはイミュータブルに差し替える(購読側のスナップショット比較のため)
    private setNextRetryAt(host: string, nextRetryAt: number | null) {
        const status = this.getDomainStatus(host)
        if (status.online || status.nextRetryAt === nextRetryAt) return
        this.domains.set(host, { ...status, nextRetryAt })
        this.emitDomainStatus(host)
    }

    // 試行回数はここでは戻さない(短命なオンラインの後の再オフラインで引き継ぐ。setDomainOnline参照)
    private stopRecoveryPoll(host: string) {
        const recovery = this.recovery.get(host)
        if (!recovery?.timer) return
        clearTimeout(recovery.timer)
        recovery.timer = null
    }

    dispose() {
        for (const host of this.recovery.keys()) {
            this.stopRecoveryPoll(host)
        }
        this.domainSubscriptions = []
        for (const socket of Object.values(this.sockets)) {
            socket.dispose()
        }
        this.sockets = {}
    }

    // 同一アカウント内のプロフィール切替用。Apiインスタンスを共有したまま新しいClientを構築する。
    // コンストラクタがapiのハンドラを新インスタンスへ付け替え、オフラインホストもApiの記録から引き継ぐため、
    // 旧クライアントは以後dispose()すること(復帰プローブは新インスタンスが引き継ぐ)
    withProfile(profile: string): Client {
        const client = new Client(this.api, this.ccid, this.entity, this.server, profile)
        // 復帰キー(onlineSince)は切替をまたいで保つ
        for (const [host, status] of this.domains) {
            if (status.online) client.domains.set(host, status)
        }
        return client
    }

    // ログイン時に保存済みの自分のwell-known(`domain:<host>`)とentity(`cckv://<ccid>`)をKVSから直接読んで構築する。
    // TTL切れでも使う(登録の実在・subkey失効の検証はアプリ側が表示後に裏で行う)ため、
    // 期限切れでthrowするfetchWithCache(force-cache)ではなくKVSを直接読む。プローブもしない。
    // 欠落(初回起動・キャッシュ削除)なら欠けている分だけネットワークから取得してKVSに保存し、
    // 到達不能なら仮の値(endpoints空)をメモリだけで使って縮退起動する(KVSには書かない。
    // 復帰時にno-cacheで取り直されて置き換わる)。
    // オンライン状態は楽観的にオンライン扱い。オフラインなら最初の失敗リクエストがonHostOnlineStatusChangedで
    // 知らせる(ここで失敗した分はApiの記録からコンストラクタが引き継ぐ)
    static async create(
        host: FQDN,
        authProvider: AuthProvider,
        cacheEngine: KVS,
        profile: string = 'main'
    ): Promise<Client> {
        const api = new Api(host, authProvider, cacheEngine)
        const ccid = authProvider.getCCID()

        const [serverEntry, entityEntry] = await Promise.all([
            cacheEngine.get<Server>(`domain:${host}`).catch(() => null),
            cacheEngine.get<SignedDocument>(`cckv://${ccid}`).catch(() => null)
        ])
        let server: Server | null = serverEntry?.data ?? null
        let entity: Entity | null = null
        if (entityEntry?.data) {
            const document: Document<Entity> = JSON.parse(entityEntry.data.document)
            entity = document.value
        }

        if (!server || !entity) {
            try {
                server ??= await api.getServer(host, { timeoutms: 5000 })
                entity ??= (await api.getEntity(ccid, undefined, { cache: 'no-cache', timeoutms: 5000 })).value
            } catch (err) {
                if (!(err instanceof ServerOfflineError)) throw err
                console.error(`server ${host} is offline. booting with placeholders...`)
                server ??= { version: '2.0', domain: host, csid: '', layer: '', endpoints: {} }
                entity ??= { domain: host, alias: '', alias_proof_type: '' }
            }
        }

        // 各種タイムラインの作成やリストの読み込みなどの初期化はアプリケーション側の責務
        return new Client(api, ccid, entity, server, profile)
    }

    // 鍵を持たないゲスト(未ログイン)用クライアント。公開リソースの閲覧のみ可能で、署名を伴う操作は行えない
    static async createAsGuest(host: FQDN, cacheEngine?: KVS): Promise<Client> {
        const api = new Api(host, new InMemoryAuthProvider(), cacheEngine ?? new InMemoryKVS())

        // 到達性をApiに記録させる(オフラインならコンストラクタが引き継いで復帰プローブを始める)
        await api.getServerOnlineStatus(host)

        // オフラインかつキャッシュなしの場合はServerOfflineErrorが伝播する
        const server = await api.getServer(host)

        const guestEntity: Entity = { domain: server.domain, alias: '', alias_proof_type: '' }
        return new Client(api, '', guestEntity, server)
    }

    // 既定はキャッシュ即返し(裏で再取得)。fresh=trueで必ずネットワークから取り直す(復帰時リフレッシュ用)
    async updateProfiles(fresh: boolean = false): Promise<void> {
        const before = JSON.stringify(this.profiles)
        await this.api
            .queryAll(
                {
                    parent: semantics.profiles(this.ccid),
                    order: 'asc'
                },
                undefined,
                { cache: fresh ? 'no-cache' : 'swr' }
            )
            .then((res) => {
                const prefixLength = semantics.profiles(this.ccid).length + 1
                for (const sd of res) {
                    const name = sd.cckv.substring(prefixLength)
                    this.profiles[name] = JSON.parse(sd.document)
                }
                console.log('Profiles updated:', this.profiles)
            })
        if (JSON.stringify(this.profiles) !== before) {
            for (const callback of this.profilesSubscriptions) {
                callback()
            }
        }
    }

    // 鮮度が重要なリソース(プロフィール・リスト設定等)をキャッシュ即表示のまま裏で最新化する。
    // 起動直後とアプリ復帰時に呼ぶ。30秒以内の連続呼び出しは直近の実行(進行中ならその完了)を返す
    refreshFreshResources(): Promise<void> {
        if (Date.now() - this.lastFreshResourcesRefresh < 30_000 && this.freshResourcesPromise) {
            return this.freshResourcesPromise
        }
        this.lastFreshResourcesRefresh = Date.now()
        this.freshResourcesPromise = this.doRefreshFreshResources()
        return this.freshResourcesPromise
    }

    private async doRefreshFreshResources(): Promise<void> {
        // 自ドメインのwell-known(サービス広告)。古いままだと後から有効化されたサービスが
        // 見えないため取り直す。ゲストでも参照される(ApNote・Explorer等)のでccidガードより前。
        // 接続先はserver.domain(well-knownの自己申告値)ではなくdefaultHostを使う
        const refreshServer = this.api
            .getServer(this.api.defaultHost, { cache: 'no-cache' })
            .then((server) => {
                if (JSON.stringify(server) === JSON.stringify(this.server)) return
                this.server = server
                for (const callback of this.serverSubscriptions) {
                    callback()
                }
            })
            .catch(() => {}) // オフライン等の失敗時は既存値を維持

        if (this.ccid === '') {
            await refreshServer
            return
        }

        await Promise.allSettled([
            refreshServer,
            this.updateProfiles(true),
            this.pinnedLists.refresh(),
            this.knownCommunities.refresh(),
            this.acknowledging.refresh(),
            this.acknowledgers.refresh(),
            this.blocks.refresh(),
            this.notificationCounter.refresh()
        ])
        const pins = await this.pinnedLists.value().catch((): PinnedListItemClass[] => [])
        await Promise.allSettled(pins.map((pin) => pin.list.refresh()))
        // リストの中身(items)はキャッシュ即表示なので、ここで裏更新する。
        // 解決済みのlistだけ対象(未解決ならvalue()時に通常経路で取得される)
        await Promise.allSettled(pins.map((pin) => pin.list.current?.items.refresh()))
    }

    // 通知画面を開いた=全部見たとみなして未読を0にする(既読位置は追跡しない)
    async resetNotificationCounter(): Promise<void> {
        this.notificationCounter.push(0)
        if (this.ccid === '') return
        await this.api.resetNotificationCounter(this.ccid, PUSH_VENDOR_ID).catch(() => {})
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
            .getAssociationsAll(target, { author: this.ccid, schema: Schemas.readAccessRequestAssociation })
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
            onUpdate: doc.onUpdate
        }
        await this.api.commit(newDoc)
    }

    // socketsのキーは実際の接続先(Socketがhost未指定ならapi.defaultHostに繋ぐ)。
    // server.domain(well-knownの自己申告値)は接続先と一致しないことがある
    async newSocket(host?: string): Promise<Socket> {
        const targetHost = host ?? this.api.defaultHost
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
        // socketのopenを待たない。購読はopen時にSocket側が再送し、先頭取得はHTTPなので
        // 接続待ち(最低200msのポーリング)で先頭表示を遅らせる理由がない。
        // 接続前後の取りこぼしはTimelineReaderがopen時にcatch-upする
        const targetHost = opts?.hostOverride ?? this.api.defaultHost
        if (!this.sockets[targetHost]) {
            this.sockets[targetHost] = new Socket(this.api, opts?.hostOverride)
        }
        return new TimelineReader(this.api, this.sockets[targetHost], opts?.hostOverride)
    }

    async newQueryTimelineReader(): Promise<QueryTimelineReader> {
        return new QueryTimelineReader(this.api)
    }

    getMessage<T>(uri: string, hint?: string): Promise<Message<T> | null> {
        // hintなしの失敗結果がhint付き呼び出しを巻き込まないよう、hint込みでキャッシュを分ける
        const cacheKey = `${uri}\0${hint ?? ''}`
        const cached = this.messageCache[cacheKey]

        if (cached && cached.expire > Date.now()) {
            return cached.data
        }

        const msg = Message.load<T>(this, uri, hint).then((m) => {
            if (m?.schema === Schemas.rerouteMessage) {
                this.rerouteTargets[uri] = (m.value as RerouteMessageSchema).targetURI
            }
            return m
        })
        this.messageCache[cacheKey] = {
            data: msg,
            expire: Date.now() + cacheLifetime
        }
        // オフライン由来の失敗は失敗ホストごとに控えておき、そのホストの復帰時にまとめて破棄する
        // (setDomainOnline参照)。reject直後に消すとuse()が再レンダーのたびに新しいpromiseを受け取り
        // 無限サスペンドになるため、失敗自体はキャッシュしたままにする
        msg.catch((err) => {
            if (!(err instanceof ServerOfflineError)) return
            if (this.messageCache[cacheKey]?.data !== msg) return
            let failed = this.failedMessages.get(err.host)
            if (!failed) {
                failed = new Map()
                this.failedMessages.set(err.host, failed)
            }
            failed.set(cacheKey, msg)
        })
        return msg
    }

    // キャッシュ済みの結果(存在しなかった場合のnull含む)を破棄して次回getMessageを再取得させる。
    // rerouteメッセージの場合はネストされたMessageContainerが表示するtargetも古いので巻き込んで破棄する
    invalidateMessage(uri: string): void {
        const target = this.rerouteTargets[uri]
        for (const key of Object.keys(this.messageCache)) {
            if (key.startsWith(`${uri}\0`) || (target && key.startsWith(`${target}\0`))) {
                delete this.messageCache[key]
            }
        }
    }

    async getUser(id: CCID, hint?: string): Promise<User | null> {
        return User.load(this, id, hint).catch(() => null)
    }

    async getTimeline(uri: string, hint?: string): Promise<Timeline | null> {
        return Timeline.load(this, uri, hint).catch(() => null)
    }

    async getList(uri: string, hint?: string, opts?: FetchOptions<SignedDocument>): Promise<List | null> {
        return List.load(this, uri, hint, opts).catch(() => null)
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

    // ack状態は片側ずつ別サーバーが持つ(CIP-10): from側はそのauthorのサーバー、
    // to側はそのassociate ownerのサーバー。閲覧者のホームではなく対象ユーザーの
    // ドメインに問い合わせる
    private async domainOf(ccid: string, hint?: string): Promise<FQDN> {
        if (ccid === this.ccid) return this.server.domain
        const entity = await this.api.getEntity(ccid, hint)
        return entity.value.domain
    }

    async getAcknowledging(ccid: string, hint?: string): Promise<Document<Acknowledge>[]> {
        const domain = await this.domainOf(ccid, hint)
        const collected = new Map<string, SignedDocument>()
        let cursor: string | undefined
        while (true) {
            const page = await this.api.requestConcrntApi<QueryResult>(domain, 'net.concrnt.core.acknowledges', {
                from: ccid,
                schema: Schemas.followAck,
                limit: '100',
                ...(cursor ? { until: cursor } : {})
            })
            for (const sd of page.items) collected.set(sd.ccfs, sd)
            if (!page.next || page.next === cursor) break
            cursor = page.next
        }
        return Array.from(collected.values()).map((sd) => JSON.parse(sd.document))
    }

    async getAcknowledgers(ccid: string, hint?: string): Promise<Document<Acknowledge>[]> {
        const domain = await this.domainOf(ccid, hint)
        const collected = new Map<string, SignedDocument>()
        let cursor: string | undefined
        while (true) {
            const page = await this.api.requestConcrntApi<QueryResult>(domain, 'net.concrnt.core.acknowledges', {
                to: ccid,
                schema: Schemas.followAck,
                limit: '100',
                ...(cursor ? { until: cursor } : {})
            })
            for (const sd of page.items) collected.set(sd.ccfs, sd)
            if (!page.next || page.next === cursor) break
            cursor = page.next
        }
        return Array.from(collected.values()).map((sd) => JSON.parse(sd.document))
    }

    async getLists(): Promise<List[]> {
        const rawlists = await this.api.queryAll({
            prefix: semantics.lists(this.ccid, this.currentProfile),
            schema: Schemas.list
        })

        const Lists = await Promise.all(rawlists.map((sd) => List.loadFromSD(this, sd)))

        return Lists
    }

    async deleteList(uri: string): Promise<void> {
        // 末尾*のrange削除でリスト本体と子要素(参照レコード)をまとめて消す。
        // サーバー側で全対象のpolicyが通った場合のみアトミックに削除される
        await this.api.delete(uri + '*')

        // stale なpinnedListsキャッシュで「pinされていない」と誤判定するとdangling pinが残るため最新を読む
        const pinned = await this.api
            .getDocument<PinnedListsSchema>(semantics.lists(this.ccid, this.currentProfile), undefined, {
                cache: 'no-cache'
            })
            .then((doc) => doc.value)
        if (pinned.some((item) => item.uri === uri)) {
            await this.removePin(uri)
        }
        this.knownCommunities.refresh()
    }

    async removePin(uri: string): Promise<void> {
        // 別端末の変更をstaleキャッシュ由来のread-modify-writeで巻き戻さないよう最新を読む
        const latestDoc = await this.api.getDocument<PinnedListsSchema>(
            semantics.lists(this.ccid, this.currentProfile),
            undefined,
            { cache: 'no-cache' }
        )
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
        // reload()は購読側をsuspendさせる。リスト設定ドロワー等、Suspense境界内で開いたオーバーレイが
        // 境界ごと隠れて閉じられなくなるため、既存値を保ったまま裏で差し替えるrefresh()で反映する
        await this.pinnedLists.refresh()
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
        // 別端末の変更をstaleキャッシュ由来のread-modify-writeで巻き戻さないよう最新を読む
        const latestDoc = await this.api.getDocument<PinnedListsSchema>(
            semantics.lists(this.ccid, this.currentProfile),
            undefined,
            { cache: 'no-cache' }
        )
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
        // removePinと同じ理由でreload()ではなくrefresh()
        await this.pinnedLists.refresh()
    }

    async updatePinnedList(
        uri: string,
        options: {
            defaultPostHome?: boolean
            defaultPostTimelines?: string[]
            defaultProfile?: string
            excludeSelf?: boolean
            isIconTab?: boolean
        }
    ): Promise<void> {
        // 別端末の変更をstaleキャッシュ由来のread-modify-writeで巻き戻さないよう最新を読む
        const latestDoc = await this.api.getDocument<PinnedListsSchema>(
            semantics.lists(this.ccid, this.currentProfile),
            undefined,
            { cache: 'no-cache' }
        )
        const newValue = latestDoc.value.map((item) => {
            if (item.uri === uri) {
                return {
                    ...item,
                    defaultPostHome: options.defaultPostHome ?? item.defaultPostHome,
                    defaultPostTimelines: options.defaultPostTimelines ?? item.defaultPostTimelines,
                    defaultProfile: options.defaultProfile ?? item.defaultProfile,
                    excludeSelf: options.excludeSelf ?? item.excludeSelf,
                    isIconTab: options.isIconTab ?? item.isIconTab
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
        // removePinと同じ理由でreload()ではなくrefresh()。呼び出し元がonComplete等で閉じる前に反映を終える
        await this.pinnedLists.refresh()
    }
}
