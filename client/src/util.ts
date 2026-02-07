import { Server } from './api'

export const fetchWithTimeout = async (url: string, init: RequestInit, timeoutMs = 10 * 1000): Promise<Response> => {
    const controller = new AbortController()
    const clientTimeout = setTimeout(() => {
        controller.abort()
    }, timeoutMs)

    const reqConfig: RequestInit = { ...init, signal: controller.signal }
    return await fetch(url, reqConfig)
        .then((res) => {
            return res
        })
        .finally(() => {
            clearTimeout(clientTimeout)
        })
}

export const parseCCURI = (uri: string): { owner: string; key: string } => {
    const parsed = new URL(uri)
    const owner = parsed.host
    const key = parsed.pathname

    return { owner, key }
}

export const renderUriTemplate = (server: Server, signature: string, arg: Record<string, any>): string => {
    const description = server.endpoints[signature]
    if (!description) {
        throw new Error(`No endpoint found for signature: ${signature}`)
    }

    let endpoint = description.template

    const queries = []
    for (const [key, value] of Object.entries(arg)) {
        if (!value) continue
        const placeholder = `{${key}}`
        if (endpoint.includes(placeholder)) {
            endpoint.replace(placeholder, value)
        }
        if (description.query && description.query.includes(key)) {
            queries.push(`${key}=${encodeURIComponent(value)}`)
        }
    }

    if (queries.length > 0) {
        endpoint += `?${queries.join('&')}`
    }

    return endpoint
}
