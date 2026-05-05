import { View, Button } from '@concrnt/ui'
import { Header } from '../ui/Header'
import { CssVar } from '../types/Theme'
import { useClient } from '../contexts/Client'
import { Passport } from '@concrnt/ui'
import Tilt from 'react-parallax-tilt'

export const IDView = () => {
    const { client } = useClient()

    if (!client) return null

    const backupMasterKey = () => {
        const privateKey = localStorage.getItem('PrivateKey')
        const text = `Concrnt Web ログイン情報
このファイルは Concrnt Web のログイン情報をバックアップするためのものです。
このファイルを安全な場所に保管してください。

CCID: ${client.ccid}
マスター秘密鍵: ${privateKey ?? '未保存'}
バックアップ時登録サーバー: ${client.server.domain ?? 'N/A'}

秘密鍵を紛失した場合、アカウントを復元できなくなる可能性があります。
この内容を他人に知られると、アカウントが乗っ取られる可能性があります。`

        const blob = new Blob([text], { type: 'text/plain;charset=utf-8' })
        const url = URL.createObjectURL(blob)
        const anchor = document.createElement('a')
        anchor.href = url
        anchor.download = `concrnt-web-backup-${client.ccid}.txt`
        anchor.click()
        URL.revokeObjectURL(url)
    }

    return (
        <View>
            <Header>ID管理</Header>
            <div
                style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: CssVar.space(2),
                    padding: CssVar.space(2),
                    flex: 1,
                    overflowY: 'auto'
                }}
            >
                <div>
                    <Tilt glareEnable={true} glareBorderRadius="5%">
                        <Passport
                            ccid={client.ccid}
                            name={client.profile?.username ?? 'No Name'}
                            avatar={client.profile?.avatar ?? ''}
                            host={client.server.domain ?? 'Unknown'}
                            cdate={''}
                        />
                    </Tilt>
                </div>

                <Button onClick={backupMasterKey}>
                    マスターキーをバックアップ
                </Button>
            </div>
        </View>
    )
}
