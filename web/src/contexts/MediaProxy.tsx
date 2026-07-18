import { renderUriTemplate } from '@concrnt/client'
import { CCImageProps, CCImageProvider } from '@concrnt/ui'
import { createContext, ReactNode, useCallback, useContext } from 'react'
import { useClient } from './Client'

export interface GetImageURLOptions {
    maxWidth?: number
    maxHeight?: number
    format?: string
}

export interface MediaProxyState {
    getImageURL: (url?: string, opts?: GetImageURLOptions) => string
}

const MediaProxyContext = createContext<MediaProxyState | undefined>(undefined)

// CCImage (@concrnt/ui) の実装として注入される、プロキシ経由の<img>
const ProxiedImage = (props: CCImageProps): ReactNode => {
    const { getImageURL } = useMediaProxy()
    const { src, maxWidth, maxHeight, ...imgProps } = props
    return <img src={getImageURL(src, { maxWidth, maxHeight })} {...imgProps} />
}

interface Props {
    children: ReactNode
}

export const MediaProxyProvider = (props: Props): ReactNode => {
    const { client } = useClient()

    const getImageURL = useCallback(
        (url?: string, opts?: GetImageURLOptions): string => {
            if (!url) return ''
            if (url.startsWith('data:') || url.startsWith('blob:')) return url

            const server = client.server

            // ccfs://<owner>/blob/<hash> -> own-server resolve endpoint, which
            // 303s to the actual file (cross-server owners included).
            let target = url
            if (url.startsWith('ccfs://')) {
                if (server && 'net.concrnt.core.resolve' in server.endpoints) {
                    target = `https://${client.api.defaultHost}${renderUriTemplate(server, 'net.concrnt.core.resolve', { uri: url })}`
                } else {
                    target = `https://${client.api.defaultHost}/api/v2/resolve?uri=${encodeURIComponent(url)}`
                }
            }

            if (server && 'world.concrnt.hyperproxy.image' in server.endpoints) {
                const operator = `${opts?.maxWidth ?? ''}x${opts?.maxHeight ?? ''}${opts?.format ? ',' + opts.format : ''}`
                const path = renderUriTemplate(server, 'world.concrnt.hyperproxy.image', {
                    operator,
                    url: target
                })
                    // uri-templateは既存のpct-triplet(%3A等)を%253Aに再エンコードしてしまう
                    // (RFC6570の予約展開ではpct-tripletは素通しが正)ので復元する
                    .replace(/%25([0-9A-Fa-f]{2})/g, '%$1')
                return `https://${server.domain}${path}`
            }

            return target
        },
        [client]
    )

    return (
        <MediaProxyContext.Provider value={{ getImageURL }}>
            <CCImageProvider component={ProxiedImage}>{props.children}</CCImageProvider>
        </MediaProxyContext.Provider>
    )
}

// Outside the provider (e.g. guest pages) this falls back to returning the raw URL.
export function useMediaProxy(): MediaProxyState {
    return useContext(MediaProxyContext) ?? { getImageURL: (url) => url ?? '' }
}
