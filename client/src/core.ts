export type CCURIScheme = 'cckv' | 'ccfs' | 'http'

export class CCURI {
    scheme: string
    owner: string
    key: string
    cdid: string
    hint?: string
    raw: string

    constructor(params: { scheme: string; owner?: string; key?: string; cdid?: string; hint?: string; raw?: string }) {
        this.scheme = params.scheme
        this.owner = params.owner ?? ''
        this.key = params.key ?? ''
        this.cdid = params.cdid ?? ''
        this.hint = params.hint
        this.raw = params.raw ?? ''
    }

    toString(): string {
        let result = this.raw

        switch (this.scheme) {
            case 'cckv':
                if (this.hint !== undefined) {
                    result = `cckv://${this.owner}@${this.hint}/${this.key}`
                } else {
                    result = `cckv://${this.owner}/${this.key}`
                }
                break

            case 'ccfs':
                if (this.hint !== undefined) {
                    result = `ccfs://${this.owner}@${this.hint}/${this.cdid}`
                } else {
                    result = `ccfs://${this.owner}/${this.cdid}`
                }
                break
        }

        if (this.key === '') {
            result = trimSuffix(result, '/')
        }

        return result
    }

    toJSON() {
        return {
            scheme: this.scheme,
            owner: this.owner,
            key: this.key,
            cdid: this.cdid,
            ...(this.hint !== undefined ? { hint: this.hint } : {}),
            raw: this.raw
        }
    }
}

export function parseCCURI(escaped: string): CCURI {
    const uriString = queryUnescapeOrThrow(escaped, 'invalid uri encoding')

    const uri = parseURLLike(uriString)
    const path = uri.path
    const key = trimPrefix(path, '/')

    let owner = ''
    let hint: string | undefined

    if (uri.user !== null) {
        if (uri.user !== '') {
            owner = uri.user
            hint = uri.host
        } else {
            owner = `@${uri.host}`
        }
    } else {
        owner = uri.host
    }

    owner = queryUnescapeOrThrow(owner, 'invalid owner encoding')

    switch (uri.scheme) {
        case 'cckv':
            return new CCURI({
                scheme: 'cckv',
                owner,
                key,
                cdid: '',
                hint,
                raw: uriString
            })

        case 'ccfs':
            return new CCURI({
                scheme: 'ccfs',
                owner,
                key: '',
                cdid: key,
                hint,
                raw: uriString
            })

        case 'http':
        case 'https':
            return new CCURI({
                scheme: 'http',
                raw: uriString
            })

        case '':
            return new CCURI({
                scheme: 'cckv',
                owner: path,
                raw: uriString
            })

        default:
            throw new Error(`unsupported uri scheme: ${uri.scheme}`)
    }
}

function queryUnescapeOrThrow(value: string, message: string): string {
    try {
        // Go の url.QueryUnescape は `+` を space として扱う。
        return decodeURIComponent(value.replace(/\+/g, ' '))
    } catch {
        throw new Error(message)
    }
}

function trimPrefix(value: string, prefix: string): string {
    return value.startsWith(prefix) ? value.slice(prefix.length) : value
}

function trimSuffix(value: string, suffix: string): string {
    return value.endsWith(suffix) ? value.slice(0, -suffix.length) : value
}

type ParsedURLLike = {
    scheme: string
    host: string
    user: string | null
    path: string
}

function parseURLLike(input: string): ParsedURLLike {
    /*
  if (/[\u0000-\u001f\u007f]/.test(input)) {
    throw new Error("invalid uri");
  }
  */

    const schemeMatch = input.match(/^([A-Za-z][A-Za-z0-9+.-]*):/)
    const scheme = schemeMatch?.[1] ?? ''

    if (scheme === '') {
        if (input.startsWith('//')) {
            const { path } = splitAuthorityAndPath(input.slice(2))
            return {
                scheme: '',
                host: '',
                user: null,
                path
            }
        }

        return {
            scheme: '',
            host: '',
            user: null,
            path: stripQueryAndFragment(input)
        }
    }

    const rest = input.slice(scheme.length + 1)

    // Go の url.Parse では `cckv:foo` のような形は Opaque になり、
    // この元コードでは path/host/user は実質空として扱われる。
    if (!rest.startsWith('//')) {
        return {
            scheme,
            host: '',
            user: null,
            path: ''
        }
    }

    const { authority, path } = splitAuthorityAndPath(rest.slice(2))
    const { host, user } = parseAuthority(authority)

    return {
        scheme,
        host,
        user,
        path
    }
}

function splitAuthorityAndPath(value: string): {
    authority: string
    path: string
} {
    let end = value.length

    for (const separator of ['/', '?', '#']) {
        const index = value.indexOf(separator)
        if (index >= 0 && index < end) {
            end = index
        }
    }

    const authority = value.slice(0, end)

    if (end < value.length && value[end] === '/') {
        return {
            authority,
            path: stripQueryAndFragment(value.slice(end))
        }
    }

    return {
        authority,
        path: ''
    }
}

function parseAuthority(authority: string): {
    host: string
    user: string | null
} {
    const at = authority.lastIndexOf('@')

    if (at === -1) {
        return {
            host: authority,
            user: null
        }
    }

    const userInfo = authority.slice(0, at)
    const host = authority.slice(at + 1)

    // Go の uri.User.Username() 相当。
    // password 部分があれば捨てる。
    const colon = userInfo.indexOf(':')
    const user = colon === -1 ? userInfo : userInfo.slice(0, colon)

    return {
        host,
        user
    }
}

function stripQueryAndFragment(value: string): string {
    let end = value.length

    for (const separator of ['?', '#']) {
        const index = value.indexOf(separator)
        if (index >= 0 && index < end) {
            end = index
        }
    }

    return value.slice(0, end)
}
