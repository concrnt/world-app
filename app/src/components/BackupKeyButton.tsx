import { invoke } from '@tauri-apps/api/core'
import { Button, Text } from '@concrnt/ui'
import { useState } from 'react'
import { useClient } from '../contexts/Client'

export const BackupKeyButton = (props: { onClick?: () => void; ccid?: string }) => {
    const clientContext = useClient()
    const client = clientContext?.client

    const [backingUp, setBackingUp] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const username = client?.profile?.username
    let filename = 'concrnt_backup'
    if (username) {
        filename += `_${username}`
    }
    const timestamp = new Date().toLocaleDateString().replace(/\//g, '-')
    filename += `_${timestamp}.txt`

    return (
        <>
            <Button
                disabled={backingUp}
                onClick={async () => {
                    props.onClick?.()
                    setError(null)
                    setBackingUp(true)
                    try {
                        await invoke('backup_masterkey', {
                            ccid: props.ccid,
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
                    } catch (err) {
                        console.error('Failed to backup masterkey', err)
                        setError(err instanceof Error ? err.message : String(err))
                    } finally {
                        setBackingUp(false)
                    }
                }}
            >
                {backingUp ? 'バックアップ中...' : 'マスターキーをバックアップ'}
            </Button>
            {error && (
                <Text style={{ color: '#ff5b5b', wordBreak: 'break-all' }}>
                    バックアップに失敗しました。
                    {'\n'}
                    {error}
                </Text>
            )}
        </>
    )
}
