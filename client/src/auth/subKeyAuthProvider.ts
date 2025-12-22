import { AuthProvider } from './interface'
import { CheckJwtIsValid, IssueJWT, JwtPayload, LoadSubKey, Sign } from '../crypto'

export class SubKeyAuthProvider implements AuthProvider {
    privatekey: string
    host: string

    ccid: string
    ckid: string

    tokens: Record<string, string> = {}

    constructor(subkey: string) {
        const parsedKey = LoadSubKey(subkey)
        if (!parsedKey) {
            throw new Error('Invalid key')
        }
        this.host = parsedKey.domain
        this.ccid = parsedKey.ccid
        this.ckid = parsedKey.ckid
        this.privatekey = parsedKey.keypair.privatekey
    }

    generateApiToken(remote: string): string {
        const token = IssueJWT(this.privatekey, {
            aud: remote,
            iss: this.ckid,
            sub: 'concrnt'
        })

        this.tokens[remote] = token

        return token
    }

    getAuthToken(remote: string): string {
        let token = this.tokens[remote]
        if (!token || !CheckJwtIsValid(token)) {
            if (this.privatekey) token = this.generateApiToken(remote)
        }
        return token
    }

    async getHeaders(domain: string) {
        return {
            authorization: `Bearer ${this.getAuthToken(domain)}`
        }
    }

    getCCID() {
        return this.ccid
    }

    getCKID() {
        return this.ckid
    }

    getHost() {
        return this.host
    }

    sign(data: string): string {
        return Sign(this.privatekey, data)
    }

    issueJWT(claims: JwtPayload): string {
        claims.iss ??= this.ccid
        return IssueJWT(this.privatekey, claims, { keyID: this.ckid })
    }
}
