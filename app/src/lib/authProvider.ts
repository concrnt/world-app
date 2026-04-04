import { invoke } from '@tauri-apps/api/core'
import { AuthProvider } from '@concrnt/client'

interface SessionState {
    ccid: string
    ckid: string
    domain: string
}

export class TauriAuthProvider implements AuthProvider {
    ccid: string
    ckid?: string

    constructor(ccid: string, ckid?: string) {
        this.ccid = ccid
        this.ckid = ckid
    }

    static async create(): Promise<TauriAuthProvider> {
        const session = await invoke<SessionState | undefined>('get_session')
        if (!session) {
            console.log('No session found')
            throw new Error('No session found')
        }
        const { ccid, ckid } = session
        return new TauriAuthProvider(ccid, ckid)
    }

    getCCID(): string {
        if (!this.ccid) {
            throw new Error('CCID not set')
        }
        return this.ccid
    }

    getCKID(): string {
        if (!this.ckid) {
            throw new Error('CKID not set')
        }
        return this.ckid
    }

    canSignMaster(): boolean {
        return true
    }

    canSignSub(): boolean {
        return true
    }

    signMaster(data: string): Promise<string> {
        return invoke<string>('sign_masterkey', { payload: data })
    }

    signSub(data: string): Promise<[string, string]> {
        return invoke<[string, string]>('sign_subkey', { payload: data })
    }
}
