import { invoke } from '@tauri-apps/api/core'
import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react'

import { Client } from '@concrnt/worldlib'
import { TauriAuthProvider } from '../lib/authProvider'
import { InMemoryKVS } from '@concrnt/client'
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

interface SessionState {
    ccid: string
    ckid: string
    domain: string
}

export const ClientProvider = (props: Props): ReactNode => {
    const [client, setClient] = useState<Client | null | undefined>(undefined)
    const [isOffline, setIsOffline] = useState(false)

    const reload = useCallback(async (name?: string) => {
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
        const kvs = new InMemoryKVS()
        Client.create(domain, authProvider, kvs, name)
            .then((client) => {
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
        localStorage.clear()
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
        return props.loading
    }

    if (client === null) {
        return props.failed
    }

    return <ClientContext.Provider value={value as ClientContextState}>{props.children}</ClientContext.Provider>
}

export function useClient(): ClientContextState {
    return useContext(ClientContext)
}
