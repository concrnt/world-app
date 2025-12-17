import { AuthProvider } from "./interface"
import { ComputeCCID, LoadKey, IssueJWT, Sign, CheckJwtIsValid, type JwtPayload } from "../crypto";

export class MasterKeyAuthProvider implements AuthProvider {

    privatekey: string
    host: string

    ccid: string

    passport?: Promise<string>
    tokens: Record<string, string> = {}

    constructor(privatekey: string, host: string) {

        this.privatekey = privatekey
        this.host = host

        const keypair = LoadKey(privatekey)
        if (!keypair) {
            throw new Error('Invalid key')
        }
        this.ccid = ComputeCCID(keypair.publickey)
    }

    generateApiToken(remote: string): string {

        const token = IssueJWT(this.privatekey, {
            aud: remote,
            iss: this.ccid,
            sub: 'concrnt',
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

    async getPassport(): Promise<string> {

        this.passport = fetch(`https://${this.host}/api/v1/auth/passport`, {
            method: 'GET',
            headers: { authorization: `Bearer ${this.getAuthToken(this.host)}` }
        })
            .then(async (res) => await res.json())
            .then((data) => {
                return data.content
            })

        return this.passport
    }

    async getHeaders(domain: string) {

        let passport = await this.passport
        if (!passport) {
            passport = await this.getPassport()
        }

        return {
            authorization: `Bearer ${this.getAuthToken(domain)}`,
            passport: passport
        };
    }

    getCCID() {
        return this.ccid
    }

    getCKID() {
        return undefined
    }

    getHost() {
        return this.host
    }

    sign(data: string): string {
        return Sign(this.privatekey, data)
    }

    issueJWT(claims: JwtPayload): string {
        claims.iss ??= this.ccid
        return IssueJWT(this.privatekey, claims)
    }
}
