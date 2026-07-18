export type CCURIScheme = 'cckv' | 'ccfs' | 'http'

export const CCFS_TYPE_CONCRNT = 'concrnt'
export const CCFS_TYPE_BLOB = 'blob'

export class CCURI {
    scheme: string
    owner: string
    key: string
    // ccfs only: CCFS_TYPE_CONCRNT or CCFS_TYPE_BLOB
    type: string
    // ccfs only: bare cdid (type=concrnt) or bare sha256 hex (type=blob)
    cdid: string
    hint?: string
    raw: string

    constructor(params: {
        scheme: string
        owner?: string
        key?: string
        type?: string
        cdid?: string
        hint?: string
        raw?: string
    }) {
        this.scheme = params.scheme
        this.owner = params.owner ?? ''
        this.key = params.key ?? ''
        this.type = params.type ?? ''
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
                if (this.key === '') {
                    result = trimSuffix(result, '/')
                }
                break

            case 'ccfs':
                if (this.hint !== undefined) {
                    result = `ccfs://${this.owner}@${this.hint}/${this.type}/${this.cdid}`
                } else {
                    result = `ccfs://${this.owner}/${this.type}/${this.cdid}`
                }
                break
        }

        return result
    }

    toJSON() {
        return {
            scheme: this.scheme,
            owner: this.owner,
            key: this.key,
            ...(this.type !== '' ? { type: this.type } : {}),
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

        case 'ccfs': {
            const parts = key.split('/')
            let ccfsType: string
            let hash: string
            if (
                parts.length === 1 &&
                parts[0] !== '' &&
                parts[0] !== CCFS_TYPE_CONCRNT &&
                parts[0] !== CCFS_TYPE_BLOB
            ) {
                // legacy flat form ccfs://<owner>/<hash>: interpret as a concrnt object
                ccfsType = CCFS_TYPE_CONCRNT
                hash = parts[0]
            } else if (parts.length === 2 && parts[0] !== '' && parts[1] !== '') {
                ccfsType = parts[0]
                hash = parts[1]
                if (ccfsType !== CCFS_TYPE_CONCRNT && ccfsType !== CCFS_TYPE_BLOB) {
                    throw new Error(`invalid ccfs type: ${ccfsType}`)
                }
                if (ccfsType === CCFS_TYPE_BLOB && !isSha256Hex(hash)) {
                    throw new Error('invalid ccfs blob hash: expected 64 hex characters')
                }
            } else {
                throw new Error('invalid ccfs uri: expected ccfs://<owner>/<type>/<hash>')
            }
            return new CCURI({
                scheme: 'ccfs',
                owner,
                key: '',
                type: ccfsType,
                cdid: hash,
                hint,
                raw: uriString
            })
        }

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

function isSha256Hex(s: string): boolean {
    if (s.length !== 64) {
        return false
    }
    for (let i = 0; i < s.length; i++) {
        const c = s[i]
        if (!((c >= '0' && c <= '9') || (c >= 'a' && c <= 'f') || (c >= 'A' && c <= 'F'))) {
            return false
        }
    }
    return true
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
