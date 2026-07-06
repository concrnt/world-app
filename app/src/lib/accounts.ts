import { invoke } from '@tauri-apps/api/core'
import { deleteResourceCache } from './cache'

export interface AccountSummary {
    ccid: string
    ckid: string | null
    domain: string | null
    isActive: boolean
}

export interface SessionInfo {
    ccid: string | null
    ckid: string | null
    domain: string | null
}

export const listAccounts = (): Promise<AccountSummary[]> => {
    return invoke<AccountSummary[]>('list_accounts')
}

export const switchAccount = (ccid: string): Promise<SessionInfo> => {
    return invoke<SessionInfo>('switch_account', { ccid })
}

// 端末からアカウント(マスターキー含む)を削除する。Rust側で生体認証が要求される。
export const removeAccount = async (ccid: string): Promise<void> => {
    await invoke('remove_account', { ccid })
    await deleteResourceCache(ccid).catch(() => {})
}

// アクティブアカウントを切り替えてアプリ全体をリロードする。
// localStorageの設定類はアカウント間で共有せず、次回起動時に再構築させる。
export const performAccountSwitch = async (ccid: string): Promise<void> => {
    await invoke('switch_account', { ccid })
    localStorage.clear()
    window.location.reload()
}
