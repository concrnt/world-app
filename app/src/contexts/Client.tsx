import { invoke } from '@tauri-apps/api/core'
import {
    createContext,
    ReactNode,
    use,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useState,
    useSyncExternalStore
} from 'react'

import { CachedPromise, Client } from '@concrnt/worldlib'
import { TauriAuthProvider } from '../lib/authProvider'
import { InMemoryKVS } from '@concrnt/client'

export interface ClientContextState {
    client?: Client
    reload: (name?: string) => Promise<void>
    logout: () => Promise<void>
}

interface Props {
    children: ReactNode
    loading?: ReactNode
    failed?: ReactNode
}

const ClientContext = createContext<ClientContextState>({
    client: undefined,
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

    if (client === undefined) {
        return props.loading
    }

    if (client === null) {
        return props.failed
    }

    return <ClientContext.Provider value={value as ClientContextState}>{props.children}</ClientContext.Provider>
}

type CachedPromiseValue<T> = T extends CachedPromise<infer V> ? V : never
type CachedPromiseKeys<T> = {
    [K in keyof T]: T[K] extends CachedPromise<any> ? K : never
}[keyof T]
type ClientCachedValue<K extends CachedPromiseKeys<Client>> = CachedPromiseValue<Client[K]>

export function useClientValue<K extends CachedPromiseKeys<Client>>(
    key: K
): [value: ClientCachedValue<K>, reload: () => void] {
    const { client } = useContext(ClientContext)

    if (!client) {
        throw new Error('Client not found')
    }

    const cachedPromise = client[key] as CachedPromise<ClientCachedValue<K>>

    const subscribe = (callback: () => void) => {
        cachedPromise.subscribe(callback)

        return () => {
            cachedPromise.unsubscribe(callback)
        }
    }

    const reload = () => {
        cachedPromise.reload()
    }

    const snapshot = useSyncExternalStore<Promise<ClientCachedValue<K>>>(subscribe, () => cachedPromise.value())

    const value = use(snapshot)

    return [value, reload]
}

export function useClient(): ClientContextState {
    return useContext(ClientContext)
}
