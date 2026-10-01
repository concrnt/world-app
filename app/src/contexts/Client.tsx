import { invoke } from '@tauri-apps/api/core'
import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Client, migrateLegacyProfilePolicies } from '@concrnt/worldlib'
import { Api, ErrorCodeRegistrationNotFound, InMemoryKVS, NotFoundError, ServerOfflineError } from '@concrnt/client'
import { TauriAuthProvider } from '../lib/authProvider'
import { deleteResourceCache, getResourceCache } from '../lib/cache'
import { Button } from '@concrnt/ui'
import { setupDefaultTimelines } from '../utils/clientSetup'
import { SubkeyInvalidDrawer } from '../components/SubkeyInvalidDrawer'
import { isPushEnabled, unregisterPush } from '../lib/push'

export interface ClientContextState {
    client: Client
    reload: (name?: string) => Promise<void>
    logout: () => Promise<void>
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
    isSubkeyInvalid: false,
    isSwitching: false,
    switchError: null,
    dismissSwitchError: () => {}
})

const ReloadClientContext = createContext<() => Promise<void>>(async () => {})

const ClientSetupProgressContext = createContext<string>('')

interface SessionState {
    ccid: string
    ckid: string
    domain: string
}

export const ClientProvider = (props: Props): ReactNode => {
    const { t } = useTranslation('', { keyPrefix: 'contexts.client' })
    const [client, setClient] = useState<Client | null | undefined>(undefined)
    const [subkeyInvalid, setSubkeyInvalid] = useState(false)
    const [progress, setProgress] = useState('')
    const [setupError, setSetupError] = useState<string | null>(null)
    // サーバーのリセットや他ドメインへの移行で、自分の登録(entity)がこのサーバーに存在しないケース
    const [notFoundOn, setNotFoundOn] = useState<string | null>(null)
    const clientRef = useRef<Client | null>(null)
    // 生きたサーバーに対して登録の実在を確認できたか。キャッシュ起動やオフライン起動ではfalseのまま
    // 表示を始め、オンライン遷移時に裏検証をやり直す
    const verifiedRef = useRef(false)
    const [isSwitching, setIsSwitching] = useState(false)
    const [switchError, setSwitchError] = useState<string | null>(null)
    // client.profilesはミューテートされるだけなので、更新通知でcontext valueを再生成して
    // client.profile直読みのコンポーネント(Sidebar等)へ反映する
    const [profilesVersion, setProfilesVersion] = useState(0)
    // client.server(well-known)も同様。復帰時リフレッシュでサービス広告が変わったら
    // client.server.endpoints直読みのコンポーネント(Settings等)へ反映する
    const [serverVersion, setServerVersion] = useState(0)

    // キャッシュから起動した後の裏検証。表示を止めずに、サーバーが「登録なし」「subkey失効」を
    // 明言した時だけ既存の画面/ドロワーへ遷移する。ネットワーク由来の失敗はfail-open。
    // 検証が通ったらデフォルトタイムラインの作成・旧設定の移行も裏で済ませる
    const verifyInBackground = useCallback(async (client: Client): Promise<void> => {
        const isCurrent = () => clientRef.current === client
        const domain = client.api.defaultHost
        const authProvider = client.api.authProvider
        // entityの取り直しは本体のKVSを通さない: fetchWithCacheは404で負キャッシュを書くため、
        // 一過性の404(CDN/経路の障害)が表示中の自分所有リソースの解決まで巻き込んでしまう。
        // well-knownは構築済みの値を流用して余計な取得を避ける
        const probe = new Api(domain, authProvider, new InMemoryKVS())
        // 縮退起動の仮well-known(endpoints空)は流用せず、プローブに取り直させる
        if (Object.keys(client.server.endpoints ?? {}).length > 0) {
            await probe.cache.set(`domain:${domain}`, client.server)
        }
        const [entityResult, subkeyResult] = await Promise.allSettled([
            probe.getEntity(client.ccid, undefined, { cache: 'no-cache' }),
            client.checkSubkeyStatus()
        ])
        if (!isCurrent()) return

        let verified = false
        if (entityResult.status === 'fulfilled') {
            client.entity = entityResult.value.value
            verified = true
        } else if (entityResult.reason instanceof ServerOfflineError) {
            // オフライン: バナーは既に出ている。オンライン遷移時に再検証する
            return
        } else if (entityResult.reason instanceof NotFoundError) {
            // NotFoundErrorはキャプティブポータルやデプロイ中CDNの404でも届く。「登録が無い」と断定できるのは、
            // 認証付きGET /registerがregistration-not-foundコードを返した時だけ(コールド起動時と同じ判定)
            try {
                await probe.getRegistration(domain, { useMasterkey: !authProvider.canSignSub() })
                // 登録は健在 = 別の404が原因。表示は続ける
            } catch (e2) {
                if (!isCurrent()) return
                if (e2 instanceof NotFoundError && e2.code === ErrorCodeRegistrationNotFound) {
                    setNotFoundOn(domain)
                    return
                }
            }
        } else {
            console.error('Background entity verification failed', entityResult.reason)
        }

        const subkeyIsInvalid = subkeyResult.status === 'fulfilled' && subkeyResult.value === 'invalid'
        if (subkeyIsInvalid) setSubkeyInvalid(true)
        if (verified) verifiedRef.current = true

        if (verified && !subkeyIsInvalid) {
            await setupDefaultTimelines(client).catch((err) => {
                console.error('Failed to set up default timelines', err)
            })
            if (!isCurrent()) return
            await migrateLegacyProfilePolicies(client).catch(console.error)
        }
    }, [])

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
                // セッション確認は一瞬なので進捗文言は出さない(キャッシュ起動ではロード画面自体が数msで消える)
                const session = await invoke<SessionState | undefined>('get_session')
                console.log('session', session)
                if (!session) {
                    console.log('No session found')
                    clientRef.current?.dispose()
                    clientRef.current = null
                    setClient(null)
                    return
                }
                const { ccid, ckid, domain } = session
                if (!ccid || !ckid || !domain) {
                    console.log('Invalid session data')
                    clientRef.current?.dispose()
                    clientRef.current = null
                    setClient(null)
                    return
                }

                // 選択中のサブプロフィールはアカウント切替/ログアウト時にlocalStorage.clear()で
                // まとめて破棄される前提で、localStorageに保持する
                const profileKey = `selectedProfile:${ccid}`
                const profileName = name ?? localStorage.getItem(profileKey) ?? undefined

                // get_sessionは上で取得済みなので、create()経由で二度呼ばない
                const authProvider = new TauriAuthProvider(ccid, ckid)
                const kvs = getResourceCache(ccid)

                // profiles / デフォルトタイムライン / pinned listsの初期化。
                // setClient前に済ませてkvsキャッシュを温めておくことで、差し替え直後の
                // remountがキャッシュから即座に構築される
                const runProfileSetup = async (client: Client, subkeyIsInvalid: boolean): Promise<void> => {
                    if (client.ccid !== '' && client.isOnline && !subkeyIsInvalid) {
                        setProgress(t('loadingProfiles'))
                        await client.updateProfiles()

                        setProgress(t('checkingTimelines'))
                        await setupDefaultTimelines(client)
                        // v1から移行したアカウントの旧形式鍵垢設定をv2形式へ移行する。失敗してもログインは止めない
                        await migrateLegacyProfilePolicies(client).catch(console.error)

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
                    let verifyAfterPaint = false

                    const current = clientRef.current
                    const canFastPath = current && current.ccid === ccid && current.api.defaultHost === domain
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
                        // 起動: ログイン時に保存済みの自分のwell-known/entityから組み立てて、ネットワークを待たずに表示する
                        // (キャッシュ欠落時のネットワーク取得、到達不能時の縮退はcreate内で完結する)。
                        // 登録の実在・subkey失効の確認、デフォルトタイムライン作成はsetClient後の裏検証で行う
                        client = await Client.create(domain, authProvider, kvs, profileName)
                        // どちらもキャッシュ即返し(IDB読み)。setClient前に済ませてHomeのスケルトンちらつきを防ぐ
                        await client.updateProfiles().catch(() => {})
                        await client.pinnedLists.value().catch(() => {})
                        verifyAfterPaint = true
                    }

                    // 保存されていたプロフィールが削除済みの場合はmainへフォールバックする
                    // (明示的な切替(name指定)は既存プロフィール一覧から選ばれるため対象外)
                    if (
                        name === undefined &&
                        client.currentProfile !== 'main' &&
                        !(client.currentProfile in client.profiles)
                    ) {
                        console.log(`Stored profile ${client.currentProfile} no longer exists. Falling back to main`)
                        localStorage.removeItem(profileKey)
                        const stale = client
                        client = stale.withProfile('main')
                        stale.dispose()
                        if (verifyAfterPaint) {
                            // 起動時はネットワークを待たない(デフォルトタイムライン作成等は裏検証が行う)
                            await client.updateProfiles().catch(() => {})
                            await client.pinnedLists.value().catch(() => {})
                        } else {
                            await runProfileSetup(client, false)
                        }
                    }

                    if (name !== undefined) {
                        localStorage.setItem(profileKey, name)
                    }

                    console.log('Client created successfully. online:', client.isOnline)
                    clientRef.current?.dispose()
                    clientRef.current = client
                    // subkey失効は表示後の裏検証で検知する(fast pathはアカウント単位で検証済み)
                    setSubkeyInvalid(false)
                    setClient(client)
                    if (verifyAfterPaint) {
                        verifyInBackground(client)
                    }
                } catch (err) {
                    console.error('Failed to create client', err)
                    if (isLiveSwitch && clientRef.current) {
                        // 旧clientはdisposeされておらずそのまま使えるため、全画面エラーには落とさず
                        // バナーで通知するに留める
                        setSwitchError(err instanceof Error ? err.message : String(err))
                        return
                    }
                    if (err instanceof NotFoundError) {
                        // NotFoundErrorはwell-knownの404、セットアップ中のcommitの404、キャプティブポータルや
                        // デプロイ中CDNの404でも届く。「登録が無い」と断定できるのは、認証付きGET /registerが
                        // registration-not-foundコードを返した時だけ。それ以外(403=認証不成立/entityなし、
                        // コード無し404=旧サーバー/経路の問題、その他)は一過性として再試行画面へ
                        const probe = new Api(domain, authProvider, new InMemoryKVS())
                        try {
                            await probe.getRegistration(domain, { useMasterkey: !authProvider.canSignSub() })
                            // 登録は健在 = 別の404が原因
                            setSetupError(err.message)
                        } catch (e2) {
                            if (e2 instanceof NotFoundError && e2.code === ErrorCodeRegistrationNotFound) {
                                setNotFoundOn(domain)
                            } else {
                                setSetupError(err.message)
                            }
                        }
                    } else {
                        setSetupError(err instanceof Error ? err.message : String(err))
                    }
                }
            } catch (err) {
                // authProviderの構築(セッション欠落でのthrow)やget_session自体の失敗など、
                // 内側のcatchが覆わない範囲の失敗。放置するとunhandled rejectionになり
                // ロード画面のまま固まるため、エラー画面に落とす
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
        [t, verifyInBackground]
    )

    useEffect(() => {
        reload()
    }, [reload])

    useEffect(() => {
        if (!client) return
        // 自ドメインがオンラインへ遷移したら、裏検証(オフライン中に起動していた場合)と
        // 鮮度重視リソースの取り直しを行う。UIの状態(バナー・再試行)はuseDomainStatusが各自で購読する
        let lastOnline = client.isOnline
        const onDomainStatusChanged = (host: string) => {
            if (host !== client.api.defaultHost) return
            const online = client.isOnline
            if (online === lastOnline) return
            lastOnline = online
            if (!online) return
            client.refreshFreshResources()
            if (!verifiedRef.current) {
                verifyInBackground(client)
            }
        }
        client.subscribeDomainStatus(onDomainStatusChanged)

        const onProfilesUpdated = () => {
            setProfilesVersion((v) => v + 1)
            // キャッシュ起動では保存されていたプロフィールがサーバー側で削除済みでも一旦表示される。
            // 裏更新で消えていたと分かった時点でmainへ戻す(明示的な切替はSidebarの一覧から選ばれるため対象外)
            if (client.currentProfile !== 'main' && !(client.currentProfile in client.profiles)) {
                console.log(`Profile ${client.currentProfile} no longer exists. Falling back to main`)
                localStorage.removeItem(`selectedProfile:${client.ccid}`)
                reload()
            }
        }
        client.subscribeProfilesUpdated(onProfilesUpdated)

        const onServerUpdated = () => {
            setServerVersion((v) => v + 1)
        }
        client.subscribeServerUpdated(onServerUpdated)

        // ブラウザがオンラインに戻ったら、オフライン中の全ドメインをbackoff待ちせず即プローブする。
        // オフラインになったら自ドメインをプローブする(失敗して遷移が発火し、リクエストが発生しない
        // アイドル状態でもバナーが表示される)
        const onBrowserOnline = () => {
            client.probeOfflineDomains()
        }
        const onBrowserOffline = () => {
            client.probeDomain(client.api.defaultHost)
        }
        window.addEventListener('online', onBrowserOnline)
        window.addEventListener('offline', onBrowserOffline)

        // 起動/クライアント差し替え直後と、アプリ復帰時に鮮度重視リソースを裏で最新化する
        // (キャッシュ即表示→取得後にpush通知でUI更新)。TauriのWebViewでも
        // foreground/backgroundでvisibilitychangeが発火するためweb/app共通実装。
        // 復帰時はオフライン中のドメインをbackoff待ちせず即プローブする(成功すれば遷移側がrefreshする)
        const onVisibilityChange = () => {
            if (document.visibilityState !== 'visible') return
            client.probeOfflineDomains()
            if (client.isOnline) client.refreshFreshResources()
        }
        document.addEventListener('visibilitychange', onVisibilityChange)
        client.refreshFreshResources()

        return () => {
            client.unsubscribeDomainStatus(onDomainStatusChanged)
            client.unsubscribeProfilesUpdated(onProfilesUpdated)
            client.unsubscribeServerUpdated(onServerUpdated)
            window.removeEventListener('online', onBrowserOnline)
            window.removeEventListener('offline', onBrowserOffline)
            document.removeEventListener('visibilitychange', onVisibilityChange)
        }
    }, [client, reload, verifyInBackground])

    const logout = useCallback(async () => {
        const ccid = clientRef.current?.ccid
        if (client && isPushEnabled()) {
            await unregisterPush(client).catch(() => {})
        }
        localStorage.clear()
        if (ccid) {
            await deleteResourceCache(ccid).catch(() => {})
        }
        await invoke('clear_session')
        reload()
    }, [client, reload])

    const dismissSwitchError = useCallback(() => {
        setSwitchError(null)
    }, [])

    const value = useMemo(() => {
        return {
            client,
            reload,
            logout,
            isSubkeyInvalid: subkeyInvalid,
            isSwitching,
            switchError,
            dismissSwitchError
        }
    }, [
        client,
        reload,
        logout,
        subkeyInvalid,
        isSwitching,
        switchError,
        dismissSwitchError,
        profilesVersion,
        serverVersion
    ])

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
                        // 他のアカウント変更フローと同様にwebviewごと再起動して初期状態から構築する
                        window.location.reload()
                    }}
                    onLogout={logout}
                />
            )}
        </ClientContext.Provider>
    )
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
