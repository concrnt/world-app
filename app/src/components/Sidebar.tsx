import { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import { useClient } from '../contexts/Client'
import { useDomainStatus } from '../hooks/useDomainStatus'

import { ListItem, Divider, Text, useTheme, List } from '@concrnt/ui'
import { Avatar } from '@concrnt/ui'

import { SettingsView } from '../views/Settings'
import { ProfileView } from '../views/Profile'
import { QueryView } from '../views/Query'
import { ListsView } from '../views/Lists'
import { useScanner } from '../contexts/Scanner'

import { MdPerson } from 'react-icons/md'
import { MdSettings } from 'react-icons/md'
import { MdTravelExplore } from 'react-icons/md'
import { MdList } from 'react-icons/md'
import { MdQrCodeScanner } from 'react-icons/md'

import { CssVar } from '../types/Theme'

import { SwitchAccountButton } from './SwitchAccountButton'
import { ConnectionStatus } from './ConnectionStatus'
import { ProfileName } from './ProfileName'

interface Props {
    onPush?: (view: ReactNode) => void
    // QR スキャンで読み取った URI。deep link と同じく Main 側で同意画面を開く
    onScanned?: (uri: string) => void
}

export const Sidebar = (props: Props) => {
    const { t } = useTranslation('', { keyPrefix: 'components.sidebar' })
    const theme = useTheme()
    const { client } = useClient()
    const homeStatus = useDomainStatus()
    const { scan } = useScanner()

    return (
        <>
            <div
                style={{
                    width: '100%',
                    height: '100%',
                    paddingTop: 'env(safe-area-inset-top)',
                    paddingBottom: 'env(safe-area-inset-bottom)',
                    backgroundColor: theme.variant === 'classic' ? CssVar.backdropBackground : 'transparent'
                }}
            >
                <div
                    style={{
                        backgroundColor: CssVar.backdropBackground,
                        color: CssVar.backdropText,
                        display: 'flex',
                        padding: CssVar.space(1),
                        flexDirection: 'column',
                        gap: CssVar.space(1),
                        height: '100%',
                        borderRadius: '0 8px 8px 0'
                    }}
                >
                    <div
                        style={{
                            display: 'flex',
                            flexDirection: 'column',
                            justifyContent: 'center',
                            padding: `${CssVar.space(1)} ${CssVar.space(2)}`,
                            gap: CssVar.space(1)
                        }}
                        onClick={() =>
                            props.onPush?.(
                                <ProfileView ccid={client?.ccid || ''} profileName={client?.currentProfile} />
                            )
                        }
                    >
                        <div
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: CssVar.space(2)
                            }}
                        >
                            <Avatar ccid={client?.ccid || ''} src={client?.profile.avatar} />
                            <Text
                                style={{
                                    flex: 1
                                }}
                            >
                                <ProfileName document={client?.profileDocument} />
                            </Text>
                            <SwitchAccountButton />
                        </div>
                        <Text variant="caption">{client?.server.domain || 'Unknown Server'}</Text>
                    </div>
                    {!homeStatus.online && (
                        <div style={{ padding: `0 ${CssVar.space(2)}` }}>
                            <ConnectionStatus />
                        </div>
                    )}
                    <Divider
                        style={{
                            marginTop: CssVar.space(2),
                            borderColor: CssVar.backdropText
                        }}
                    />
                    <List
                        dense
                        disablePadding
                        style={{
                            color: CssVar.backdropText
                        }}
                    >
                        <ListItem
                            icon={<MdPerson size={24} />}
                            onClick={() =>
                                props.onPush?.(
                                    <ProfileView ccid={client?.ccid || ''} profileName={client?.currentProfile} />
                                )
                            }
                        >
                            {t('profile')}
                        </ListItem>
                        <ListItem icon={<MdList size={24} />} onClick={() => props.onPush?.(<ListsView />)}>
                            {t('lists')}
                        </ListItem>
                        <ListItem icon={<MdTravelExplore size={24} />} onClick={() => props.onPush?.(<QueryView />)}>
                            {t('query')}
                        </ListItem>
                        <ListItem icon={<MdSettings size={24} />} onClick={() => props.onPush?.(<SettingsView />)}>
                            {t('settings')}
                        </ListItem>
                    </List>
                    <div style={{ flex: 1 }} />
                    {/* QR スキャン (他の端末のログイン / 外部サービスへのログイン) は使用頻度が低いので最下部に置く。
                        受け皿のページは持たず、スキャナーを直接起動する。キャンセルならこのサイドバーに戻るだけ */}
                    <List
                        dense
                        disablePadding
                        style={{
                            color: CssVar.backdropText
                        }}
                    >
                        <ListItem
                            icon={<MdQrCodeScanner size={24} />}
                            onClick={() => {
                                scan().then((result) => {
                                    if (result) props.onScanned?.(result)
                                })
                            }}
                        >
                            {t('scanQrCode')}
                        </ListItem>
                    </List>
                    <Divider
                        style={{
                            marginTop: CssVar.space(2),
                            borderColor: CssVar.backdropText
                        }}
                    />
                    <div
                        style={{
                            fontSize: '0.6rem',
                            padding: CssVar.space(1),
                            textAlign: 'center'
                        }}
                    >
                        Concrnt World App
                    </div>
                </div>
            </div>
        </>
    )
}
