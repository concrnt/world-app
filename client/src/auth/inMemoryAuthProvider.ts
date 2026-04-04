import { AuthProvider } from './interface'
import { ComputeCCID, LoadKey, Sign, LoadSubKey } from '../crypto'

export class InMemoryAuthProvider implements AuthProvider {
    masterkey?: string
    subkey?: string

    ccid: string
    ckid?: string

    constructor(masterkey?: string, subkey?: string) {
        let ccid = ''

        if (masterkey) {
            this.masterkey = masterkey
            const keypair = LoadKey(masterkey)
            if (!keypair) {
                throw new Error('Invalid key')
            }
            ccid = ComputeCCID(keypair.publickey)
        }

        if (subkey) {
            const parsedKey = LoadSubKey(subkey)
            if (!parsedKey) {
                throw new Error('Invalid subkey')
            }
            ccid = parsedKey.ccid
            this.ckid = parsedKey.ckid
            this.subkey = parsedKey.keypair.privatekey
        }

        this.ccid = ccid
    }

    getCCID() {
        return this.ccid
    }

    getCKID() {
        return this.ckid
    }

    canSignMaster() {
        return !!this.masterkey
    }

    canSignSub() {
        return !!this.subkey && !!this.ckid
    }

    signMaster(data: string): Promise<string> {
        if (!this.masterkey) {
            throw new Error('Master key not available')
        }
        return Promise.resolve(Sign(this.masterkey, data))
    }

    signSub(data: string): Promise<[string, string]> {
        if (!this.subkey || !this.ckid) {
            throw new Error('Sub key not available')
        }
        return Promise.resolve([Sign(this.subkey, data), this.ckid])
    }
}
