import { invoke } from '@tauri-apps/api/core'
import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react'

import { Client } from '@concrnt/worldlib'
import { TauriAuthProvider } from '../lib/authProvider'
import { resourceCache } from '../lib/cache'
import { Button } from '@concrnt/ui'
import { setupDefaultTimelines } from '../utils/clientSetup'

export interface ClientContextState {
    client: Client
    reload: (name?: string) => Promise<void>
    logout: () => Promise<void>
}

interface Props {
    children: ReactNode
    loading?: ReactNode
    failed?: ReactNode
}

const ClientContext = createContext<ClientContextState>({
    client: {} as Client,
    reload: async () => {},
    logout: async () => {}
})

const ReloadClientContext = createContext<() => Promise<void>>(async () => {})

const ClientSetupProgressContext = createContext<string>('')

interface SessionState {
    ccid: string
    ckid: string
    domain: string
}

export const ClientProvider = (props: Props): ReactNode => {
    const [client, setClient] = useState<Client | null | undefined>(undefined)
    const [isOffline, setIsOffline] = useState(false)
    const [progress, setProgress] = useState('')

    const reload = useCallback(async (name?: string) => {
        console.log('Reloading client for profile', name)
        setProgress('セッションを確認しています...')
        const session = await invoke<SessionState | undefined>('get_session')
        console.log('session', session)
        if (!session) {
            console.log('No session found')
            setClient(null)
            return
        }
        const { ccid, ckid, domain } = session
        if (!ccid || !ckid || !domain) {
            console.log('Invalid sessb.rsion data')
            setClient(null)
            return
        }

        const authProvider = await TauriAuthProvider.create()
        const kvs = resourceCache
        try {
            setProgress('サーバーに接続しています...')
            const client = await Client.create(domain, authProvider, kvs, name)

            if (client.ccid !== '') {
                setProgress('プロフィールを読み込んでいます...')
                await client.updateProfiles()

                setProgress('タイムラインを確認しています...')
                await setupDefaultTimelines(client)

                setProgress('リストを読み込んでいます...')
                await client.pinnedLists.value()
            }

            console.log('Client created successfully')
            setClient(client)
        } catch (err) {
            console.error('Failed to create client', err)
            if (err instanceof Error && err.message === `server ${domain} is offline`) {
                setIsOffline(true)
            }
        }
    }, [])

    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        reload()
    }, [reload])

    const logout = useCallback(async () => {
        localStorage.clear()
        await resourceCache.clear()
        await invoke('clear_session')
        reload()
    }, [])

    const value = useMemo(() => {
        return {
            client,
            reload,
            logout
        }
    }, [client, reload, logout])

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
