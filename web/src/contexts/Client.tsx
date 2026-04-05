import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react'

import { Client } from '@concrnt/worldlib'
import { InMemoryAuthProvider, InMemoryKVS } from '@concrnt/client'
import { usePersistent } from '../hooks/usePersistent'

export interface ClientContextState {
    client?: Client
    reload: () => Promise<void>
    logout: () => Promise<void>
}

interface Props {
    children: ReactNode
}

const ClientContext = createContext<ClientContextState>({
    client: undefined,
    reload: async () => {},
    logout: async () => {}
})


export const ClientProvider = (props: Props): ReactNode => {

    const [domain] = usePersistent<string>('Domain')
    const [prvkey] = usePersistent<string>('PrivateKey')
    const [subkey] = usePersistent<string>('SubKey')

    const [client, setClient] = useState<Client | null | undefined>(undefined)

    const reload = useCallback(async () => {
        const authProvider = new InMemoryAuthProvider(prvkey, subkey)
        const kvs = new InMemoryKVS()
        Client.create(domain ?? 'v2dev.concrnt.net', authProvider, kvs)
            .then((client) => {
                setClient(client)
            })
            .catch((e) => {
                console.error(e)
                setClient(null)
            })
    }, [])

    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        reload()
    }, [reload])

    const logout = useCallback(async () => {
        localStorage.clear()
        reload()
    }, [])

    const value = useMemo(() => {
        return {
            client,
            reload,
            logout
        }
    }, [client, reload, logout])

    if (!client) {
        return <>Loading...</>
    }

    console.log("oOoOoOoO Client loaded oOoOoOoO")

    return <ClientContext.Provider value={value as ClientContextState}>{props.children}</ClientContext.Provider>
}

export function useClient(): ClientContextState {
    return useContext(ClientContext)
}
