import { useState } from 'react'
import { View, Button, Divider, Skeleton, ConcrntLogo } from '@concrnt/ui'
import { Header } from '../ui/Header'
import { CssVar } from '../types/Theme'
import { useScanner } from '../contexts/Scanner'
import { AvatarUploader } from '../components/AvatarUploader'
import { MessageLayout } from '../components/message/MessageLayout'
import { invoke } from '@tauri-apps/api/core'
import { useClient } from '../contexts/Client'

export const DevView = () => {
    const { client } = useClient()
    const { scan } = useScanner()
    const [scanned, setScanned] = useState<string>('')

    const [avatar, setAvatar] = useState<string>('')

    return (
        <View>
            <Header>Devtools</Header>
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
                <Button
                    onClick={() => {
                        scan().then((result) => {
                            if (result) {
                                setScanned(result)
                                console.log('Scanned:', result)
                            } else {
                                console.log('No scan result')
                            }
                        })
                    }}
                >
                    Scan
                </Button>

                <Button
                    onClick={() => {
                        window.location.reload()
                    }}
                >
                    Reload
                </Button>

                <pre>
                    <code>{scanned}</code>
                </pre>

                <Divider />

                <AvatarUploader
                    src={avatar}
                    onChange={(url) => {
                        setAvatar(url)
                        console.log('Avatar URL:', url)
                    }}
                />

                <MessageLayout
                    left={
                        <Skeleton
                            style={{
                                width: '40px',
                                height: '40px'
                            }}
                        />
                    }
                    headerLeft={
                        <Skeleton
                            style={{
                                height: '1rem'
                            }}
                        />
                    }
                >
                    <Skeleton
                        style={{
                            height: '3rem'
                        }}
                    />
                </MessageLayout>
                <ConcrntLogo size="100px" upperColor="#0476d9" lowerColor="#0476d9" frameColor="#0476d9" spinning />

                <Button
                    onClick={() => {
                        invoke('backup_masterkey', {
                            template: `Concrnt ログイン情報
このファイルは Concrnt のログイン情報をバックアップするためのものです。
このファイルを安全な場所に保管してください。

CCID: \${ccid}
マスターキー: \${mnemonic_ja}
バックアップ時登録サーバー: ${client?.server.domain ?? 'N/A'}

もし、マスターキーを紛失した場合、アカウントを復元することができなくなります。
また、この内容を他人に知られると、アカウントが永久に乗っ取られる可能性があります。安全な場所に保管してください。`
                        })
                    }}
                >
                    bakup keys
                </Button>
            </div>
        </View>
    )
}
