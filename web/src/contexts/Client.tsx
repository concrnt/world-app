/* eslint-disable react-refresh/only-export-components */
import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { InMemoryAuthProvider, InMemoryKVS } from '@concrnt/client'
import { Client } from '@concrnt/worldlib'

export type ClientStatus = 'loading' | 'failed' | 'logged-out' | 'ready'

export interface ClientContextState {
    client?: Client
    status: ClientStatus
    error?: string
    reload: (profileName?: string) => Promise<void>
    logout: () => Promise<void>
}

interface Props {
    children: ReactNode
}

const ClientContext = createContext<ClientContextState>({
    client: undefined,
    status: 'loading',
    error: undefined,
    reload: async () => {},
    logout: async () => {}
})

const readStoredValue = (key: string): string | undefined => {
    const raw = localStorage.getItem(key)
    if (!raw) return undefined

    try {
        return JSON.parse(raw) ?? undefined
    } catch {
        return undefined
    }
}

export const ClientProvider = (props: Props): ReactNode => {
    const [client, setClient] = useState<Client | undefined>(undefined)
    const [status, setStatus] = useState<ClientStatus>('loading')
    const [error, setError] = useState<string | undefined>(undefined)

    const reload = useCallback(async (profileName?: string) => {
        setStatus('loading')
        setError(undefined)

        const domain = readStoredValue('Domain')
        const prvkey = readStoredValue('PrivateKey')
        const subkey = readStoredValue('SubKey')

        if (!domain || (!prvkey && !subkey)) {
            setClient(undefined)
            setStatus('logged-out')
            return
        }

        try {
            const authProvider = new InMemoryAuthProvider(prvkey, subkey)

            if (!authProvider.canSignMaster() && !authProvider.canSignSub()) {
                setClient(undefined)
                setStatus('logged-out')
                return
            }

            const kvs = new InMemoryKVS()
            const nextClient = await Client.create(domain, authProvider, kvs, profileName)
            setClient(nextClient)
            setStatus('ready')
        } catch (caught) {
            console.error(caught)
            setClient(undefined)
            setError(caught instanceof Error ? caught.message : 'Unknown client initialization error')
            setStatus('failed')
        }
    }, [])

    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        void reload()
    }, [reload])

    const logout = useCallback(async () => {
        localStorage.clear()
        setClient(undefined)
        setError(undefined)
        setStatus('logged-out')
    }, [])

    const value = useMemo(
        () => ({
            client,
            status,
            error,
            reload,
            logout
        }),
        [client, status, error, reload, logout]
    )

    return <ClientContext.Provider value={value}>{props.children}</ClientContext.Provider>
}

export function useClient(): ClientContextState {
    return useContext(ClientContext)
}
