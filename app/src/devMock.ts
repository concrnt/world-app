import { mockIPC } from '@tauri-apps/api/mocks'
import { ComputeCKID, GenerateIdentity, LoadIdentity, Sign } from '@concrnt/client'

// ブラウザで vite dev を開いたときだけ main.tsx から読み込まれ、src-tauri のコマンドを localStorage 上で再現する。
// ここに無いコマンド(モバイル専用プラグイン)は reject し、呼び出し側の「プラグインが無い環境」の経路に乗せる。

interface Account {
    ccid: string
    mnemonic: string
    subPriv: string | null
    ckid: string | null
    domain: string | null
}

interface Args {
    ccid?: string
    mnemonic?: string
    payload?: string
    domain?: string
    template?: string
    filename?: string
    content?: string
    message?: string
    buttons?: { OkCancelCustom: [string, string] }
    url?: string
}

const STORAGE_KEY = 'devmock:accounts'

const download = (filename: string, content: string): void => {
    const link = document.createElement('a')
    link.href = URL.createObjectURL(new Blob([content], { type: 'text/plain' }))
    link.download = filename
    link.click()
}

mockIPC(
    (cmd, payload) => {
        const args = (payload ?? {}) as Args
        const store: { active: string | null; accounts: Account[] } = JSON.parse(
            localStorage.getItem(STORAGE_KEY) ?? '{"active":null,"accounts":[]}'
        )
        const save = (): void => localStorage.setItem(STORAGE_KEY, JSON.stringify(store))
        const activeCcid = store.accounts.some((a) => a.ccid === store.active)
            ? store.active
            : (store.accounts[0]?.ccid ?? null)
        const target = store.accounts.find((a) => a.ccid === (args.ccid ?? activeCcid))

        switch (cmd) {
            case 'initialize_master': {
                const identity = GenerateIdentity()
                store.accounts.push({
                    ccid: identity.CCID,
                    mnemonic: identity.mnemonic,
                    subPriv: null,
                    ckid: null,
                    domain: null
                })
                store.active = identity.CCID
                save()
                return identity.CCID
            }
            case 'initialize_from_mnemonic': {
                const identity = LoadIdentity(args.mnemonic!)
                if (!identity) throw new Error('invalid mnemonic')
                if (!store.accounts.some((a) => a.ccid === identity.CCID)) {
                    store.accounts.push({
                        ccid: identity.CCID,
                        mnemonic: identity.mnemonic,
                        subPriv: null,
                        ckid: null,
                        domain: null
                    })
                }
                store.active = identity.CCID
                save()
                return identity.CCID
            }
            case 'load_identity': {
                const identity = LoadIdentity(args.mnemonic!)
                if (!identity) throw new Error('invalid mnemonic')
                return identity
            }
            case 'create_subkey': {
                const sub = GenerateIdentity()
                target!.subPriv = sub.privateKey
                target!.ckid = ComputeCKID(sub.publicKey)
                save()
                return target!.ckid
            }
            case 'set_domain':
                target!.domain = args.domain!
                save()
                return null
            case 'clear_session':
                target!.subPriv = null
                target!.ckid = null
                save()
                return null
            case 'get_session':
                return target ? { ccid: target.ccid, ckid: target.ckid, domain: target.domain } : null
            case 'get_active_ccid':
                return activeCcid
            case 'list_accounts':
                return store.accounts.map((a) => ({
                    ccid: a.ccid,
                    ckid: a.ckid,
                    domain: a.domain,
                    isActive: a.ccid === activeCcid
                }))
            case 'switch_account':
                store.active = target!.ccid
                save()
                return { ccid: target!.ccid, ckid: target!.ckid, domain: target!.domain }
            case 'remove_account':
                if (!window.confirm('このアカウントを端末から削除します。よろしいですか？')) return false
                store.accounts = store.accounts.filter((a) => a.ccid !== args.ccid)
                if (activeCcid === args.ccid) store.active = store.accounts[0]?.ccid ?? null
                save()
                return true
            case 'sign_masterkey':
                return Sign(LoadIdentity(target!.mnemonic)!.privateKey, args.payload!)
            case 'sign_subkey':
                return [Sign(target!.subPriv!, args.payload!), target!.ckid]
            case 'backup_masterkey': {
                const identity = LoadIdentity(target!.mnemonic)!
                download(
                    args.filename!.trim() || 'concrnt_masterkey_backup.txt',
                    args
                        .template!.split('${mnemonic}')
                        .join(identity.mnemonic)
                        .split('${mnemonic_ja}')
                        .join(identity.mnemonic_ja)
                        .split('${ccid}')
                        .join(identity.CCID)
                )
                return null
            }
            case 'save_backup_file':
                download(args.filename!.trim(), args.content!)
                return null
            case 'plugin:dialog|message':
                return window.confirm(args.message) ? args.buttons!.OkCancelCustom[0] : null
            case 'plugin:opener|open_url':
                window.open(args.url, '_blank')
                return null
            default:
                throw new Error(`devMock: ${cmd} is not mocked`)
        }
    },
    { shouldMockEvents: true }
)
