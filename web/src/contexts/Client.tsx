import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'

import { Client } from '@concrnt/worldlib'
import { InMemoryAuthProvider, ServerOfflineError } from '@concrnt/client'
import { Button } from '@concrnt/ui'
import { setupDefaultTimelines } from '../utils/clientSetup'
import { resourceCache } from '../lib/cache'

export interface ClientContextState {
    client: Client
    reload: (name?: string) => Promise<void>
    logout: () => Promise<void>
    isDomainOffline: boolean
    domainRecovered: boolean
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
    domainRecovered: false
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
    const [client, setClient] = useState<Client | null | undefined>(undefined)
    const [isOffline, setIsOffline] = useState(false)
    const [isDomainOffline, setIsDomainOffline] = useState(false)
    const [domainRecovered, setDomainRecovered] = useState(false)
    const [progress, setProgress] = useState('')
    const clientRef = useRef<Client | null>(null)
    const bootedOfflineRef = useRef(false)

    const reload = useCallback(async (name?: string) => {
        console.log('Reloading client for profile', name)
        setProgress('セッションを確認しています...')

        const domain = readStoredString('Domain')
        const masterKey = readStoredString('PrivateKey')
        const subKey = readStoredString('SubKey')

        if (!domain || (!masterKey && !subKey)) {
            console.log('No web session found')
            clientRef.current?.dispose()
            clientRef.current = null
            setClient(null)
            return
        }

        const authProvider = new InMemoryAuthProvider(masterKey, subKey)
        const kvs = resourceCache
        try {
            setProgress('サーバーに接続しています...')
            const client = await Client.create(domain, authProvider, kvs, name)

            if (client.ccid !== '' && client.isOnline) {
                setProgress('プロフィールを読み込んでいます...')
                await client.updateProfiles()

                setProgress('タイムラインを確認しています...')
                await setupDefaultTimelines(client)

                setProgress('リストを読み込んでいます...')
                await client.pinnedLists.value()
            } else if (client.ccid !== '') {
                // 読み取り専用起動: キャッシュからベストエフォートで読み込む
                // setupDefaultTimelinesはcommitを行うため実行しない
                setProgress('キャッシュから読み込んでいます...')
                await client.updateProfiles().catch(() => {})
                await client.pinnedLists.value().catch(() => {})
            }

            console.log('Client created successfully. online:', client.isOnline)
            clientRef.current?.dispose()
            clientRef.current = client
            bootedOfflineRef.current = !client.isOnline
            setIsDomainOffline(!client.isOnline)
            setDomainRecovered(false)
            setClient(client)
        } catch (err) {
            console.error('Failed to create client', err)
            if (err instanceof ServerOfflineError) {
                setIsOffline(true)
            }
        }
    }, [])

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
        localStorage.removeItem('Domain')
        localStorage.removeItem('PrivateKey')
        localStorage.removeItem('SubKey')
        await resourceCache.clear()
        await reload()
    }, [])

    const value = useMemo(() => {
        return {
            client,
            reload,
            logout,
            isDomainOffline,
            domainRecovered
        }
    }, [client, reload, logout, isDomainOffline, domainRecovered])

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
                サーバーはオフラインです
                <Button
                    onClick={() => {
                        setIsOffline(false)
                        reload()
                    }}
                >
                    再試行
                </Button>
                <Button
                    onClick={async () => {
                        await logout()
                        window.location.reload()
                    }}
                >
                    ログアウト
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

    return <ClientContext.Provider value={value as ClientContextState}>{props.children}</ClientContext.Provider>
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
