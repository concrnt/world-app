import { invoke } from '@tauri-apps/api/core'
import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react'

import { Client } from '@concrnt/worldlib'
import { TauriAuthProvider } from '../lib/authProvider'
import { Api, Entity, InMemoryKVS, Server } from '@concrnt/client'
import { Button, Text } from '@concrnt/ui'

export interface ClientContextState {
    client: Client
    reload: (name?: string) => Promise<void>
    logout: () => Promise<void>
    offlineDomain: string | null
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
    offlineDomain: null
})

const ReloadClientContext = createContext<() => Promise<void>>(async () => {})

interface SessionState {
    ccid: string
    ckid: string
    domain: string
}

export const ClientProvider = (props: Props): ReactNode => {
    const [client, setClient] = useState<Client | null | undefined>(undefined)
    const [offlineDomain, setOfflineDomain] = useState<string | null>(null)

    const reload = useCallback(async (name?: string) => {
        console.log('Reloading client for profile', name)
        setClient(undefined)
        setOfflineDomain(null)
        const session = await invoke<SessionState | undefined>('get_session')
        console.log('session', session)
        if (!session) {
            console.log('No session found')
            setClient(null)
            setOfflineDomain(null)
            return
        }
        const { ccid, ckid, domain } = session
        if (!ccid || !ckid || !domain) {
            console.log('Invalid sessb.rsion data')
            setClient(null)
            setOfflineDomain(null)
            return
        }

        const authProvider = await TauriAuthProvider.create()
        const kvs = new InMemoryKVS()
        await Client.create(domain, authProvider, kvs, name)
            .then((client) => {
                console.log('Client created successfully')
                setOfflineDomain(null)
                setClient(client)
            })
            .catch((err) => {
                console.error('Failed to create client', err)
                if (err instanceof Error && err.message === `server ${domain} is offline`) {
                    const server: Server = {
                        version: 'offline',
                        domain,
                        csid: '',
                        layer: '',
                        endpoints: {}
                    }
                    const entity: Entity = {
                        domain,
                        alias: '',
                        alias_proof_type: ''
                    }
                    const offlineClient = new Client(
                        new Api(domain, authProvider, kvs),
                        authProvider.getCCID(),
                        entity,
                        server,
                        name
                    )
                    setOfflineDomain(domain)
                    setClient(offlineClient)
                    return
                }
                setClient(null)
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
            logout,
            offlineDomain
        }
    }, [client, reload, logout, offlineDomain])

    if (offlineDomain) {
        if (!client) {
            return <ReloadClientContext.Provider value={reload}>{props.loading}</ReloadClientContext.Provider>
        }

        return (
            <ClientContext.Provider value={value as ClientContextState}>
                <OfflineDomainBanner domain={offlineDomain} reload={reload} logout={logout} />
                {props.children}
            </ClientContext.Provider>
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

const OfflineDomainBanner = (props: { domain: string; reload: () => Promise<void>; logout: () => Promise<void> }) => {
    return (
        <div
            style={{
                position: 'fixed',
                top: 'calc(env(safe-area-inset-top) + 8px)',
                left: '50%',
                transform: 'translateX(-50%)',
                zIndex: 10000,
                width: 'min(520px, calc(100vw - 24px))',
                boxSizing: 'border-box',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px 10px',
                borderRadius: '8px',
                backgroundColor: '#202124',
                color: '#fff',
                boxShadow: '0 6px 20px rgba(0, 0, 0, 0.25)'
            }}
        >
            <Text style={{ flex: 1, fontSize: '13px' }}>
                {props.domain} に接続できません。自ドメイン依存の機能は一部利用できません。
            </Text>
            <Button variant="text" onClick={() => props.reload()} style={{ color: '#fff' }}>
                再試行
            </Button>
            <Button
                variant="text"
                onClick={async () => {
                    await props.logout()
                    window.location.reload()
                }}
                style={{ color: '#fff' }}
            >
                ログアウト
            </Button>
        </div>
    )
}

export function useClient(): ClientContextState {
    return useContext(ClientContext)
}

export function useReloadClient(): () => void {
    return useContext(ReloadClientContext)
}
