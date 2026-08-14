import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Client, migrateLegacyProfilePolicies, semantics } from '@concrnt/worldlib'
import {
    Api,
    ComputeCKID,
    Document,
    Entity,
    GenerateIdentity,
    InMemoryAuthProvider,
    InMemoryKVS,
    NotFoundError,
    ServerOfflineError,
    SignedDocument
} from '@concrnt/client'
import { Button } from '@concrnt/ui'
import { setupDefaultTimelines } from '../utils/clientSetup'
import { resourceCache } from '../lib/cache'
import { isPushEnabled, unregisterPush } from '../lib/push'
import { SubkeyInvalidDrawer } from '../components/SubkeyInvalidDrawer'

export interface ClientContextState {
    client: Client
    reload: (name?: string) => Promise<void>
    logout: () => Promise<void>
    isDomainOffline: boolean
    domainRecovered: boolean
    isSubkeyInvalid: boolean
    isSwitching: boolean
    switchError: string | null
    dismissSwitchError: () => void
}

interface Props {
    children: ReactNode
    loading?: ReactNode
    failed?: ReactNode
}

const ClientContext = createContext<ClientContextState>({
    client: {} as Client,
    reload: async () => {},
    logout: async () => {},
    isDomainOffline: false,
    domainRecovered: false,
    isSubkeyInvalid: false,
    isSwitching: false,
    switchError: null,
    dismissSwitchError: () => {}
})

const ReloadClientContext = createContext<() => Promise<void>>(async () => {})

const ClientSetupProgressContext = createContext<string>('')

const readStoredString = (key: string): string | undefined => {
    const value = localStorage.getItem(key)
    if (!value) return undefined

    try {
        const parsed = JSON.parse(value)
        return typeof parsed === 'string' ? parsed : undefined
    } catch {
        return value
    }
}

export const ClientProvider = (props: Props): ReactNode => {
    const { t } = useTranslation('', { keyPrefix: 'contexts.client' })
    const [client, setClient] = useState<Client | null | undefined>(undefined)
    const [isOffline, setIsOffline] = useState(false)
    const [isDomainOffline, setIsDomainOffline] = useState(false)
    const [domainRecovered, setDomainRecovered] = useState(false)
    const [subkeyInvalid, setSubkeyInvalid] = useState(false)
    const [progress, setProgress] = useState('')
    const [setupError, setSetupError] = useState<string | null>(null)
    // サーバーのリセットや他ドメインへの移行で、自分の登録(entity)がこのサーバーに存在しないケース
    const [notFoundOn, setNotFoundOn] = useState<string | null>(null)
    const clientRef = useRef<Client | null>(null)
    const bootedOfflineRef = useRef(false)
    const [isSwitching, setIsSwitching] = useState(false)
    const [switchError, setSwitchError] = useState<string | null>(null)
    // client.profilesはミューテートされるだけなので、更新通知でcontext valueを再生成して
    // client.profile直読みのコンポーネント(Sidebar等)へ反映する
    const [profilesVersion, setProfilesVersion] = useState(0)
    // client.server(well-known)も同様。復帰時リフレッシュでサービス広告が変わったら
    // client.server.endpoints直読みのコンポーネント(Settings等)へ反映する
    const [serverVersion, setServerVersion] = useState(0)

    const reload = useCallback(
        async (name?: string) => {
            console.log('Reloading client for profile', name)
            // 既にclientがある状態での呼び出し(プロフィール切替など)は、全画面のロード/エラー画面に
            // 遷移せず、旧clientを表示したままバックグラウンドで新clientを構築して差し替える
            const isLiveSwitch = clientRef.current != null
            setSwitchError(null)
            setSetupError(null)
            setNotFoundOn(null)
            if (isLiveSwitch) setIsSwitching(true)
            try {
                setProgress(t('checkingSession'))

                const domain = readStoredString('Domain')
                const masterKey = readStoredString('PrivateKey')
                let subKey = readStoredString('SubKey')

                if (!domain || (!masterKey && !subKey)) {
                    console.log('No web session found')
                    clientRef.current?.dispose()
                    clientRef.current = null
                    setClient(null)
                    return
                }

                // マスターキーのみのセッションはv1(concrnt-world)からの引き継ぎでしか発生しない
                // (v2のログインは必ずsubkeyを発行する)。通常の書き込みはsubkey署名なので、
                // ここでログインフローと同様にsubkeyを発行して揃える。失敗してもマスターキーのみで
                // 続行する(読み取りは可能・次回起動で再試行される)
                if (masterKey && !subKey) {
                    try {
                        const masterProvider = new InMemoryAuthProvider(masterKey)
                        const ccid = masterProvider.getCCID()
                        const api = new Api(domain, masterProvider, new InMemoryKVS())
                        const subIdentity = GenerateIdentity()
                        const ckid = ComputeCKID(subIdentity.publicKey)
                        const subkeyDoc: Document<any> = {
                            kind: 'record',
                            key: semantics.subkey(ccid, ckid),
                            author: ccid,
                            schema: 'https://schema.concrnt.net/subkey.json',
                            value: { ckid },
                            createdAt: new Date(),
                            onUpdate: 'retain'
                        }
                        await api.commit(subkeyDoc, domain, { useMasterkey: true })
                        subKey = `concrnt-subkey ${subIdentity.privateKey} ${ccid}@${domain} -`
                        localStorage.setItem('SubKey', subKey)
                        console.log('Provisioned a subkey for the migrated master key session')
                    } catch (err) {
                        console.error('Failed to provision subkey for master key session', err)
                    }
                }

                // 選択中のサブプロフィールはログアウト時に他のセッションキーと一緒に破棄する
                const profileName = name ?? readStoredString('SelectedProfile')

                const authProvider = new InMemoryAuthProvider(masterKey, subKey)
                const kvs = resourceCache

                // profiles / デフォルトタイムライン / pinned listsの初期化。
                // setClient前に済ませてキャッシュを温めておくことで、差し替え直後の
                // remountがキャッシュから即座に構築される
                const runProfileSetup = async (client: Client, subkeyIsInvalid: boolean): Promise<void> => {
                    if (client.ccid !== '' && client.isOnline && !subkeyIsInvalid) {
                        setProgress(t('loadingProfiles'))
                        await client.updateProfiles()

                        setProgress(t('checkingTimelines'))
                        await setupDefaultTimelines(client)
                        // v1から移行したアカウントの旧形式鍵垢設定をv2形式へ移行する。失敗してもログインは止めない
                        await migrateLegacyProfilePolicies(client).catch(console.error)

                        // v1から自動移行されたエンティティ(proof:none)のマスターキーによる再コミット。
                        // 通常はログイン画面(ensureEntityProof)が行うが、v1のlocalStorageからセッションを
                        // 引き継いだ場合はログイン画面を通らないため、移行時に立てたフラグを見てここで行う。
                        // 失敗してもログインは止めない(フラグが残るため次回起動で再試行される)
                        if (
                            localStorage.getItem('V1EntityProofPending') !== null &&
                            client.api.authProvider.canSignMaster()
                        ) {
                            await (async () => {
                                const self = await client.api.getResource<SignedDocument>(
                                    semantics.user(client.ccid),
                                    undefined,
                                    { cache: 'no-cache' }
                                )
                                if (self.proof?.type === 'none') {
                                    console.log('Entity proof type is "none", re-committing entity with master key...')
                                    const entityDoc: Document<Entity> = {
                                        kind: 'entity',
                                        author: client.ccid,
                                        schema: 'https://schema.concrnt.net/entity.json',
                                        value: JSON.parse(self.document).value,
                                        createdAt: new Date()
                                    }
                                    await client.api.commit(entityDoc, client.server.domain, { useMasterkey: true })
                                }
                                localStorage.removeItem('V1EntityProofPending')
                            })().catch(console.error)
                        }

                        setProgress(t('loadingLists'))
                        await client.pinnedLists.value()
                    } else if (client.ccid !== '') {
                        // 読み取り専用起動、またはsubkeyが無効な場合: キャッシュ/ベストエフォートで読み込む
                        // setupDefaultTimelinesはcommitを行うため実行しない
                        setProgress(t('loadingFromCache'))
                        await client.updateProfiles().catch(() => {})
                        await client.pinnedLists.value().catch(() => {})
                    }
                }

                try {
                    let client: Client
                    let subkeyIsInvalid = false

                    const current = clientRef.current
                    const canFastPath =
                        current && current.ccid === authProvider.getCCID() && current.api.defaultHost === domain
                    if (current && canFastPath) {
                        // 同一アカウント内のプロフィール切替: Api/entity/serverを再利用して
                        // ネットワークアクセスを省く。subkeyの状態はアカウント単位なので再チェックしない
                        try {
                            client = current.withProfile(profileName ?? 'main')
                            await runProfileSetup(client, false)
                        } catch (err) {
                            console.error('Fast profile switch failed, falling back to full reload', err)
                            client = await Client.create(domain, authProvider, kvs, profileName)
                            await runProfileSetup(client, false)
                        }
                    } else {
                        setProgress(t('connectingToServer'))
                        client = await Client.create(domain, authProvider, kvs, profileName)

                        // サーバーリセットや他デバイスからのrevokeで、自分のsubkeyが失効していないか確認する
                        // (オフライン起動時はどのみち書き込みができないため確認しない)
                        if (client.ccid !== '' && client.isOnline) {
                            setProgress(t('checkingKeyStatus'))
                            subkeyIsInvalid = (await client.checkSubkeyStatus()) === 'invalid'
                        }

                        await runProfileSetup(client, subkeyIsInvalid)
                    }

                    // 保存されていたプロフィールが削除済みの場合はmainへフォールバックする
                    // (明示的な切替(name指定)は既存プロフィール一覧から選ばれるため対象外)
                    if (
                        name === undefined &&
                        client.currentProfile !== 'main' &&
                        !(client.currentProfile in client.profiles)
                    ) {
                        console.log(`Stored profile ${client.currentProfile} no longer exists. Falling back to main`)
                        localStorage.removeItem('SelectedProfile')
                        const stale = client
                        client = stale.withProfile('main')
                        stale.dispose()
                        await runProfileSetup(client, subkeyIsInvalid)
                    }

                    if (name !== undefined) {
                        localStorage.setItem('SelectedProfile', name)
                    }

                    console.log('Client created successfully. online:', client.isOnline)
                    clientRef.current?.dispose()
                    clientRef.current = client
                    bootedOfflineRef.current = !client.isOnline
                    setIsDomainOffline(!client.isOnline)
                    setDomainRecovered(false)
                    setSubkeyInvalid(subkeyIsInvalid)
                    setClient(client)
                } catch (err) {
                    console.error('Failed to create client', err)
                    if (isLiveSwitch && clientRef.current) {
                        // 旧clientはdisposeされておらずそのまま使えるため、全画面エラーには落とさず
                        // バナーで通知するに留める
                        setSwitchError(err instanceof Error ? err.message : String(err))
                        return
                    }
                    if (err instanceof ServerOfflineError) {
                        setIsOffline(true)
                    } else if (err instanceof NotFoundError) {
                        // NotFoundErrorはentity 404以外(well-knownの404、セットアップ中のcommitの404、
                        // キャプティブポータルやデプロイ中CDNの404)でも届く。「登録が見つからない」と
                        // 断定する前に、自分の登録が本当に無いのかを使い捨てApiで直接確認する
                        const probe = new Api(domain, new InMemoryAuthProvider(), new InMemoryKVS())
                        const serverErr = await probe
                            .getServer(domain, { cache: 'no-cache' })
                            .then(() => null)
                            .catch((e) => e)
                        if (serverErr) {
                            // well-known自体が取れない = サーバー側/経路の問題。一過性として再試行画面へ
                            if (serverErr instanceof ServerOfflineError) {
                                setIsOffline(true)
                            } else {
                                setSetupError(err.message)
                            }
                        } else {
                            const entityErr = await probe
                                .getEntity(authProvider.getCCID(), undefined, { cache: 'no-cache' })
                                .then(() => null)
                                .catch((e) => e)
                            if (entityErr instanceof NotFoundError) {
                                // 本当に登録が無い(サーバーのリセットや移行など)
                                setNotFoundOn(domain)
                            } else {
                                // entityは実在する(or判定不能) = 別の404が原因。再試行画面へ
                                setSetupError(err.message)
                            }
                        }
                    } else {
                        setSetupError(err instanceof Error ? err.message : String(err))
                    }
                }
            } catch (err) {
                // authProviderの構築(壊れた鍵素材でのthrow)など、内側のcatchが覆わない範囲の失敗。
                // 放置するとunhandled rejectionになりロード画面のまま固まるため、エラー画面に落とす
                console.error('Failed to set up client', err)
                if (isLiveSwitch && clientRef.current) {
                    setSwitchError(err instanceof Error ? err.message : String(err))
                } else {
                    setSetupError(err instanceof Error ? err.message : String(err))
                }
            } finally {
                setIsSwitching(false)
            }
        },
        [t]
    )

    useEffect(() => {
        reload()
    }, [reload])

    useEffect(() => {
        if (!client) return
        const onStatusChanged = (online: boolean) => {
            if (online) {
                if (bootedOfflineRef.current) {
                    // 読み取り専用起動だった場合は再初期化が必要なので、バナーに再接続ボタンを出す
                    setDomainRecovered(true)
                } else {
                    setIsDomainOffline(false)
                }
            } else {
                setIsDomainOffline(true)
                setDomainRecovered(false)
            }
        }
        client.subscribeOnlineStatus(onStatusChanged)

        const onProfilesUpdated = () => {
            setProfilesVersion((v) => v + 1)
        }
        client.subscribeProfilesUpdated(onProfilesUpdated)

        const onServerUpdated = () => {
            setServerVersion((v) => v + 1)
        }
        client.subscribeServerUpdated(onServerUpdated)

        // オンライン/オフラインとも即時プローブする(オフライン時はプローブが失敗して遷移が発火し、
        // リクエストが発生しないアイドル状態でもバナーが表示される)
        const onBrowserNetworkChange = () => {
            client.probeDomainStatus()
        }
        window.addEventListener('online', onBrowserNetworkChange)
        window.addEventListener('offline', onBrowserNetworkChange)

        // 起動/クライアント差し替え直後と、アプリ復帰時に鮮度重視リソースを裏で最新化する
        // (キャッシュ即表示→取得後にpush通知でUI更新)。TauriのWebViewでも
        // foreground/backgroundでvisibilitychangeが発火するためweb/app共通実装
        const onVisibilityChange = () => {
            if (document.visibilityState === 'visible') {
                client.refreshFreshResources()
            }
        }
        document.addEventListener('visibilitychange', onVisibilityChange)
        client.refreshFreshResources()

        return () => {
            client.unsubscribeOnlineStatus(onStatusChanged)
            client.unsubscribeProfilesUpdated(onProfilesUpdated)
            client.unsubscribeServerUpdated(onServerUpdated)
            window.removeEventListener('online', onBrowserNetworkChange)
            window.removeEventListener('offline', onBrowserNetworkChange)
            document.removeEventListener('visibilitychange', onVisibilityChange)
        }
    }, [client])

    const logout = useCallback(async () => {
        // push購読はこのブラウザに紐づくため、セッションを破棄する前に解除しておく
        const current = clientRef.current
        if (current && isPushEnabled()) {
            await unregisterPush(current).catch(() => {})
        }
        // ログアウトはセッション(サブキー/接続先)の破棄のみ。マスターキー(PrivateKey/Mnemonic)は
        // 削除しない: 同じ鍵で他サーバーへ登録・再ログインできることがアカウントモデルの前提であり、
        // 鍵を消す操作はバックアップDLを強制するResetSessionButtonだけに限定する(app版のclear_sessionと同じ方針)
        localStorage.removeItem('Domain')
        localStorage.removeItem('SubKey')
        localStorage.removeItem('SelectedProfile')
        localStorage.removeItem('V1EntityProofPending')
        await resourceCache.clear()
        await reload()
    }, [reload])

    const dismissSwitchError = useCallback(() => {
        setSwitchError(null)
    }, [])

    const value = useMemo(() => {
        return {
            client,
            reload,
            logout,
            isDomainOffline,
            domainRecovered,
            isSubkeyInvalid: subkeyInvalid,
            isSwitching,
            switchError,
            dismissSwitchError
        }
    }, [
        client,
        reload,
        logout,
        isDomainOffline,
        domainRecovered,
        subkeyInvalid,
        isSwitching,
        switchError,
        dismissSwitchError,
        profilesVersion,
        serverVersion
    ])

    if (isOffline) {
        return (
            <div
                style={{
                    width: '100vw',
                    height: '100dvh',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center',
                    alignItems: 'center',
                    gap: '1rem'
                }}
            >
                {t('serverOffline')}
                <Button
                    onClick={() => {
                        setIsOffline(false)
                        reload()
                    }}
                >
                    {t('retry')}
                </Button>
                <Button
                    onClick={async () => {
                        await logout()
                        window.location.reload()
                    }}
                >
                    {t('logout')}
                </Button>
            </div>
        )
    }

    if (notFoundOn) {
        return (
            <div
                style={{
                    width: '100vw',
                    height: '100dvh',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center',
                    alignItems: 'center',
                    gap: '1rem',
                    padding: '1.5rem',
                    textAlign: 'center'
                }}
            >
                {t('registrationNotFound', { domain: notFoundOn })}
                <div style={{ fontSize: '0.85rem', opacity: 0.7 }}>{t('registrationNotFoundDesc')}</div>
                <Button
                    onClick={() => {
                        setNotFoundOn(null)
                        reload()
                    }}
                >
                    {t('retry')}
                </Button>
                <Button
                    onClick={async () => {
                        await logout()
                        window.location.reload()
                    }}
                >
                    {t('logout')}
                </Button>
            </div>
        )
    }

    if (setupError) {
        return (
            <div
                style={{
                    width: '100vw',
                    height: '100dvh',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center',
                    alignItems: 'center',
                    gap: '1rem',
                    padding: '1.5rem',
                    textAlign: 'center'
                }}
            >
                {t('loadFailed')}
                <div style={{ fontSize: '0.85rem', opacity: 0.7, wordBreak: 'break-all' }}>{setupError}</div>
                <Button
                    onClick={() => {
                        setSetupError(null)
                        reload()
                    }}
                >
                    {t('retry')}
                </Button>
                <Button
                    onClick={async () => {
                        await logout()
                        window.location.reload()
                    }}
                >
                    {t('logout')}
                </Button>
            </div>
        )
    }

    if (client === undefined) {
        return (
            <ReloadClientContext.Provider value={reload}>
                <ClientSetupProgressContext.Provider value={progress}>
                    {props.loading}
                </ClientSetupProgressContext.Provider>
            </ReloadClientContext.Provider>
        )
    }

    if (client === null) {
        return <ReloadClientContext.Provider value={reload}>{props.failed}</ReloadClientContext.Provider>
    }

    return (
        <ClientContext.Provider value={value as ClientContextState}>
            {/* プロフィール切替中のバナーでも進捗文言を表示できるよう、メイン分岐にも進捗を提供する */}
            <ClientSetupProgressContext.Provider value={progress}>{props.children}</ClientSetupProgressContext.Provider>
            {subkeyInvalid && (
                <SubkeyInvalidDrawer
                    client={client}
                    onRecovered={async () => {
                        // ソフトリロードは差し替え直後の再フェッチ嵐でフリーズし得るため、
                        // 他のアカウント変更フローと同様にページごと再読み込みして初期状態から構築する
                        window.location.reload()
                    }}
                    onLogout={logout}
                />
            )}
        </ClientContext.Provider>
    )
}

// ゲスト(未ログイン)閲覧用。createAsGuestで作ったClientを既存のuseClient()消費者にそのまま供給する
export const GuestClientProvider = (props: { client: Client; children: ReactNode }): ReactNode => {
    const value = useMemo<ClientContextState>(
        () => ({
            client: props.client,
            reload: async () => {},
            logout: async () => {},
            isDomainOffline: false,
            domainRecovered: false,
            isSubkeyInvalid: false,
            isSwitching: false,
            switchError: null,
            dismissSwitchError: () => {}
        }),
        [props.client]
    )
    return <ClientContext.Provider value={value}>{props.children}</ClientContext.Provider>
}

export function useClient(): ClientContextState {
    return useContext(ClientContext)
}

export function useReloadClient(): () => void {
    return useContext(ReloadClientContext)
}

// ClientProviderのloadingノード内で、現在のセットアップ処理の内容を表示するために使う
export function useClientSetupProgress(): string {
    return useContext(ClientSetupProgressContext)
}
