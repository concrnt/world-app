import { load } from '@tauri-apps/plugin-store';
import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from 'react'

import { Client } from '@concrnt/worldlib'

export interface ClientContextState {
    client?: Client
    uninitialized?: boolean
}

export interface ClientProviderProps {
    children: ReactNode
}

const ClientContext = createContext<ClientContextState>({
    client: undefined,
    uninitialized: undefined,
})

interface ClientInfo {
    domain: string
    privatekey: string
}

export const ClientProvider = (props: ClientProviderProps): ReactNode => {

    const [client, setClient] = useState<Client>()
    const [uninitialized, setUninitialized] = useState<boolean>()

    useEffect(() => {
        load('clientInfo.json').then((store) => {
            store.get<ClientInfo>('ClientInfo').then(value => {
                if (!value || value.privatekey === "" || value.domain === "") {
                    setUninitialized(true)
                    return
                }

                setUninitialized(false)

                Client.create(value.privatekey, value.domain)
                    .then((client) => {
                        setClient(client)
                    })
                    .catch((e) => {
                        console.error(e)
                    })
            }).catch((e) => {
                console.error(e)
                setUninitialized(true)
            })
        }).catch((e) => {
            console.error(e)
            setUninitialized(true)
        })
    }, [])

    const value = useMemo(() => {
        return {
            client,
            uninitialized,
        }
    }, [client, uninitialized])

    return <ClientContext.Provider value={value as ClientContextState}>{props.children}</ClientContext.Provider>
}

export function useClient(): ClientContextState {
    return useContext(ClientContext)
}
