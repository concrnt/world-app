import { load } from '@tauri-apps/plugin-store'
import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react'

import { Client } from '@concrnt/worldlib'
import { Api, GenerateIdentity, InMemoryKVS, MasterKeyAuthProvider } from '@concrnt/client'

export interface ClientContextState {
    client?: Client
    uninitialized?: boolean
    initialize: () => Promise<void>
    logout: () => Promise<void>
}

export interface ClientProviderProps {
    children: ReactNode
}

const ClientContext = createContext<ClientContextState>({
    client: undefined,
    uninitialized: undefined,
    initialize: async () => {},
    logout: async () => {}
})

interface ClientInfo {
    domain: string
    privatekey: string
}

export const ClientProvider = (props: ClientProviderProps): ReactNode => {
    const [client, setClient] = useState<Client>()
    const [uninitialized, setUninitialized] = useState<boolean>()

    useEffect(() => {
        load('clientInfo.json')
            .then((store) => {
                store
                    .get<ClientInfo>('ClientInfo')
                    .then((value) => {
                        if (!value || value.privatekey === '' || value.domain === '') {
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
                    })
                    .catch((e) => {
                        console.error(e)
                        setUninitialized(true)
                    })
            })
            .catch((e) => {
                console.error(e)
                setUninitialized(true)
            })
    }, [])

    const initialize = useCallback(async () => {
        const identity = GenerateIdentity()

        const host = 'cc2.tunnel.anthrotech.dev'

        const authProvider = new MasterKeyAuthProvider(identity.privateKey, host)
        const cacheEngine = new InMemoryKVS()

        const api = new Api(authProvider, cacheEngine)

        const document = {
            author: identity.CCID,
            schema: 'https://schema.concrnt.net/affiliation.json',
            value: {
                domain: host
            },
            createdAt: new Date().toISOString()
        }

        const docString = JSON.stringify(document)
        const signature = authProvider.sign(docString)

        const request = {
            affiliationDocument: docString,
            affiliationSignature: signature,
            meta: {}
        }

        api.requestConcrntApi(
            host,
            'net.concrnt.world.register',
            {},
            {
                method: 'POST',
                body: JSON.stringify(request),
                headers: {
                    'Content-Type': 'application/json'
                }
            }
        ).then(() => {
            console.log('Registered')
            load('clientInfo.json').then((store) => {
                store.set('ClientInfo', {
                    domain: host,
                    privatekey: identity.privateKey
                })
                store.save()
            })
            Client.create(identity.privateKey, host)
                .then((client) => {
                    setClient(client)
                    setUninitialized(false)
                })
                .catch((e) => {
                    console.error(e)
                })
        })
    }, [])

    const logout = useCallback(async () => {
        load('clientInfo.json').then((store) => {
            store.clear().then(() => {
                setClient(undefined)
                setUninitialized(true)
            })
        })
    }, [])

    const value = useMemo(() => {
        return {
            client,
            uninitialized,
            initialize,
            logout
        }
    }, [client, uninitialized, initialize, logout])

    return <ClientContext.Provider value={value as ClientContextState}>{props.children}</ClientContext.Provider>
}

export function useClient(): ClientContextState {
    return useContext(ClientContext)
}
