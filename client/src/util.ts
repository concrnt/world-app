import { Server } from './api'
import { parse } from 'uri-template'

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

export const renderUriTemplate = (server: Server, signature: string, args: Record<string, any>): string => {
    const templateStr = server.endpoints[signature]
    if (!templateStr) {
        throw new Error(`No endpoint found for signature: ${signature}`)
    }

    const template = parse(templateStr)
    return template.expand(args)
}

export function toHexString(byteArray: Uint8Array | number[]): string {
    return Array.from(byteArray, function (byte) {
        return ('0' + (byte & 0xff).toString(16)).slice(-2)
    }).join('')
}

export function parseHexString(hexString: string): Uint8Array {
    return new Uint8Array((hexString.match(/.{1,2}/g) ?? []).map((byte) => parseInt(byte, 16)))
}

export const makeUrlSafe = (input: string): string => {
    return input.replaceAll('=', '').replaceAll('+', '-').replaceAll('/', '_')
}

export const btoa = (input: string): string => {
    // use window.btoa if we are in the browser
    if (typeof window !== 'undefined') {
        return window.btoa(input)
    }
    if (typeof Buffer !== 'undefined') {
        return Buffer.from(input, 'binary').toString('base64')
    }

    console.error('no way to encode base64')
    return ''
}

export const atob = (input: string): string => {
    // use window.atob if we are in the browser
    if (typeof window !== 'undefined') {
        return window.atob(input)
    }
    if (typeof Buffer !== 'undefined') {
        return Buffer.from(input, 'base64').toString('binary')
    }

    console.error('no way to decode base64')
    return ''
}
