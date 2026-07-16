import { invoke } from '@tauri-apps/api/core'
import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Client } from '@concrnt/worldlib'
import { NotFoundError, ServerOfflineError } from '@concrnt/client'
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
    isDomainOffline: boolean
    domainRecovered: boolean
    isSubkeyInvalid: boolean
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
    isSubkeyInvalid: false
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

    const reload = useCallback(
        async (name?: string) => {
            console.log('Reloading client for profile', name)
            setSetupError(null)
            setNotFoundOn(null)
            setProgress(t('checkingSession'))
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

            const authProvider = await TauriAuthProvider.create()
            const kvs = getResourceCache(ccid)
            try {
                setProgress(t('connectingToServer'))
                const client = await Client.create(domain, authProvider, kvs, name)

                // サーバーリセットや他デバイスからのrevokeで、自分のsubkeyが失効していないか確認する
                // (オフライン起動時はどのみち書き込みができないため確認しない)
                let subkeyIsInvalid = false
                if (client.ccid !== '' && client.isOnline) {
                    setProgress(t('checkingKeyStatus'))
                    subkeyIsInvalid = (await client.checkSubkeyStatus()) === 'invalid'
                }

                if (client.ccid !== '' && client.isOnline && !subkeyIsInvalid) {
                    setProgress(t('loadingProfiles'))
                    await client.updateProfiles()

                    setProgress(t('checkingTimelines'))
                    await setupDefaultTimelines(client)

                    setProgress(t('loadingLists'))
                    await client.pinnedLists.value()
                } else if (client.ccid !== '') {
                    // 読み取り専用起動、またはsubkeyが無効な場合: キャッシュ/ベストエフォートで読み込む
                    // setupDefaultTimelinesはcommitを行うため実行しない
                    setProgress(t('loadingFromCache'))
                    await client.updateProfiles().catch(() => {})
                    await client.pinnedLists.value().catch(() => {})
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
                if (err instanceof ServerOfflineError) {
                    setIsOffline(true)
                } else if (err instanceof NotFoundError) {
                    // サーバーは応答しているが、自分の登録が見つからない(サーバーのリセットや移行など)。
                    // 再試行しても復帰しないため、ログアウトを促す専用画面を出す。
                    setNotFoundOn(domain)
                } else {
                    setSetupError(err instanceof Error ? err.message : String(err))
                }
            }
        },
        [t]
    )

    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect
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

        // オンライン/オフラインとも即時プローブする(オフライン時はプローブが失敗して遷移が発火し、
        // リクエストが発生しないアイドル状態でもバナーが表示される)
        const onBrowserNetworkChange = () => {
            client.probeDomainStatus()
        }
        window.addEventListener('online', onBrowserNetworkChange)
        window.addEventListener('offline', onBrowserNetworkChange)

        return () => {
            client.unsubscribeOnlineStatus(onStatusChanged)
            window.removeEventListener('online', onBrowserNetworkChange)
            window.removeEventListener('offline', onBrowserNetworkChange)
        }
    }, [client])

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

    const value = useMemo(() => {
        return {
            client,
            reload,
            logout,
            isDomainOffline,
            domainRecovered,
            isSubkeyInvalid: subkeyInvalid
        }
    }, [client, reload, logout, isDomainOffline, domainRecovered, subkeyInvalid])

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
            {props.children}
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
