import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react'

import { Client } from '@concrnt/worldlib'
import { InMemoryAuthProvider, InMemoryKVS } from '@concrnt/client'
import { Button } from '@concrnt/ui'

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

    const reload = useCallback(async (name?: string) => {
        console.log('Reloading client for profile', name)

        const domain = readStoredString('Domain')
        const masterKey = readStoredString('PrivateKey')
        const subKey = readStoredString('SubKey')

        if (!domain || (!masterKey && !subKey)) {
            console.log('No web session found')
            setClient(null)
            return
        }

        const authProvider = new InMemoryAuthProvider(masterKey, subKey)
        const kvs = new InMemoryKVS()
        await Client.create(domain, authProvider, kvs, name)
            .then((client) => {
                console.log('Client created successfully')
                setClient(client)
            })
            .catch((err) => {
                console.error('Failed to create client', err)
                if (err instanceof Error && err.message === `server ${domain} is offline`) {
                    setIsOffline(true)
                }
            })
    }, [])

    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        reload()
    }, [reload])

    const logout = useCallback(async () => {
        localStorage.removeItem('Domain')
        localStorage.removeItem('PrivateKey')
        localStorage.removeItem('SubKey')
        await reload()
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
        return <ReloadClientContext.Provider value={reload}>{props.loading}</ReloadClientContext.Provider>
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
