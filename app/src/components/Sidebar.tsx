import { ReactNode } from 'react'

import { useClient } from '../contexts/Client'

import { ListItem, Divider, Text, useTheme, List } from '@concrnt/ui'
import { Avatar } from '@concrnt/ui'

import { SettingsView } from '../views/Settings'
import { ProfileView } from '../views/Profile'
import { QueryView } from '../views/Query'
import { ListsView } from '../views/Lists'

import { MdPerson } from 'react-icons/md'
import { MdSettings } from 'react-icons/md'
import { MdTravelExplore } from 'react-icons/md'
import { MdList } from 'react-icons/md'

import { CssVar } from '../types/Theme'

import { SwitchAccountButton } from './SwitchAccountButton'
import { ProfileName } from './ProfileName'

interface Props {
    onPush?: (view: ReactNode) => void
}

export const Sidebar = (props: Props) => {
    const theme = useTheme()
    const { client } = useClient()

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
                            <Text>
                                <ProfileName document={client?.profileDocument} />
                            </Text>
                            <div style={{ flex: 1 }} />
                            <SwitchAccountButton />
                        </div>
                        <Text variant="caption">{client?.server.domain || 'Unknown Server'}</Text>
                    </div>
                    <Divider />
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
                            プロフィール
                        </ListItem>
                        <ListItem icon={<MdList size={24} />} onClick={() => props.onPush?.(<ListsView />)}>
                            リスト
                        </ListItem>
                        <ListItem icon={<MdTravelExplore size={24} />} onClick={() => props.onPush?.(<QueryView />)}>
                            照会
                        </ListItem>
                        <ListItem icon={<MdSettings size={24} />} onClick={() => props.onPush?.(<SettingsView />)}>
                            設定
                        </ListItem>
                    </List>
                    <div style={{ flex: 1 }} />
                    <Divider />
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
