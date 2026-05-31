import type { ReactNode } from 'react'
import { Button, Text } from '@concrnt/ui'
import { CssVar } from '../types/Theme'
import { useClient } from '../contexts/Client'
import { Passport } from '@concrnt/ui'
import Tilt from 'react-parallax-tilt'
import { View } from '../components/View'
import { Header } from '../components/Header'
import { MdBadge, MdPublic } from 'react-icons/md'

const InfoTile = ({ icon, label, value }: { icon: ReactNode; label: string; value: string }) => {
    return (
        <div
            style={{
                border: `1px solid ${CssVar.divider}`,
                borderRadius: '8px',
                padding: CssVar.space(2),
                display: 'grid',
                gridTemplateRows: '24px 18px 24px',
                gap: CssVar.space(1),
                minWidth: 0
            }}
        >
            <div style={{ color: CssVar.contentLink, display: 'flex', alignItems: 'center' }}>{icon}</div>
            <Text variant="caption" style={{ margin: 0, lineHeight: '18px' }}>
                {label}
            </Text>
            <Text
                variant="h5"
                style={{
                    margin: 0,
                    lineHeight: '24px',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap'
                }}
            >
                {value}
            </Text>
        </div>
    )
}

export const IDView = () => {
    const { client } = useClient()

    if (!client) return null

    const username = client.profile?.username
    const alias = client.entity.alias || '<未設定>'

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
                <div style={{ display: 'flex', flexDirection: 'column', gap: CssVar.space(0.5) }}>
                    <Text variant="h3">Passport</Text>
                    <Text variant="caption">現在のID、登録サーバー、認証情報を確認できます。</Text>
                </div>

                <div>
                    <Tilt glareEnable={true} glareBorderRadius="5%">
                        <Passport
                            ccid={client.ccid}
                            name={username ?? 'No Name'}
                            avatar={client.profile?.avatar ?? ''}
                            host={client.server.domain ?? 'Unknown'}
                            cdate={''}
                        />
                    </Tilt>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: CssVar.space(2) }}>
                    <InfoTile icon={<MdBadge size={24} />} label="エイリアス" value={alias} />
                    <InfoTile
                        icon={<MdPublic size={24} />}
                        label="Home Server"
                        value={client.server.domain ?? 'Unknown'}
                    />
                </div>

                <Button onClick={backupMasterKey}>マスターキーをバックアップ</Button>
            </div>
        </View>
    )
}
