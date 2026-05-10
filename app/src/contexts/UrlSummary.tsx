import { fetchWithTimeout } from '@concrnt/client'
import { createContext, ReactNode, useCallback, useContext, useRef } from 'react'
import { useClient } from './Client'

export interface Summary {
    title: string
    icon: string
    description: string
    thumbnail: string
    sitename: string
    url: string
}

export interface UrlSummaryState {
    getSummary: (url: string) => Promise<Summary | undefined>
}

const UrlSummaryContext = createContext<UrlSummaryState | undefined>(undefined)

interface Props {
    children: ReactNode
}

export const UrlSummaryProvider = (props: Props): ReactNode => {
    const { client } = useClient()
    const cache = useRef<Record<string, Promise<Summary | undefined>>>({})
    const host = client.server.domain

    const getSummary = useCallback(
        async (url: string): Promise<Summary | undefined> => {
            if (url in cache.current) return await cache.current[url]
            const promise = fetchWithTimeout(`https://${host}/summary?url=${encodeURIComponent(url)}`, {})
                .then(async (response) => {
                    if (!response.ok) return undefined
                    const json = await response.json()
                    return json as Summary
                })
                .catch(() => undefined)

            cache.current[url] = promise
            return promise
        },
        [host]
    )

    return <UrlSummaryContext.Provider value={{ getSummary }}>{props.children}</UrlSummaryContext.Provider>
}

export function useUrlSummary(): UrlSummaryState | undefined {
    return useContext(UrlSummaryContext)
}
