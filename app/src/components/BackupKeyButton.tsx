import { invoke } from '@tauri-apps/api/core'
import { Button } from '@concrnt/ui'
import { useClient } from '../contexts/Client'

export const BackupKeyButton = (props: { onClick?: () => void }) => {
    const clientContext = useClient()
    const client = clientContext?.client

    const username = client?.profile?.username
    let filename = 'concrnt_backup'
    if (username) {
        filename += `_${username}`
    }
    const timestamp = new Date().toLocaleDateString().replace(/\//g, '-')
    filename += `_${timestamp}.txt`

    return (
        <Button
            onClick={() => {
                props.onClick?.()
                invoke('backup_masterkey', {
                    filename: filename,
                    template: `Concrnt ログイン情報
このファイルは Concrnt のログイン情報をバックアップするためのものです。
このファイルを安全な場所に保管してください。

CCID: \${ccid}
マスターキー: \${mnemonic_ja}
バックアップ時登録サーバー: ${client?.server?.domain ?? 'N/A'}

もし、マスターキーを紛失した場合、アカウントを復元することができなくなります。
また、この内容を他人に知られると、アカウントが永久に乗っ取られる可能性があります。安全な場所に保管してください。`
                })
            }}
        >
            マスターキーをバックアップ
        </Button>
    )
}
