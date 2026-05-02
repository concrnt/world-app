import { ReactNode } from 'react'

import { useClient } from '../contexts/Client'

import { ListItem, Divider, Text, useTheme, List } from '@concrnt/ui'
import { Avatar } from '@concrnt/ui'

import { SettingsView } from '../views/Settings'
import { DevView } from '../views/Dev'
import { ProfileView } from '../views/Profile'
import { QueryView } from '../views/Query'
import { ListsView } from '../views/Lists'

import { MdPerson } from 'react-icons/md'
import { MdTerminal } from 'react-icons/md'
import { MdSettings } from 'react-icons/md'
import { MdTravelExplore } from 'react-icons/md'
import { MdList } from 'react-icons/md'
import { MdBadge } from 'react-icons/md'
import { SiActivitypub } from 'react-icons/si'

import { CssVar } from '../types/Theme'

import { SwitchAccountButton } from './SwitchAccountButton'
import { IDView } from '../views/ID'
import { Activitypub } from '../views/Activitypub'

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
                            <Text
                                style={{
                                    flex: 1
                                }}
                            >
                                {client?.profile.username || 'Unknown User'}
                            </Text>
                            <SwitchAccountButton />
                        </div>
                        <Text variant="caption">{client?.server.domain || 'Unknown Server'}</Text>
                    </div>
                    <Divider />
                    <List
                        style={{
                            color: CssVar.backdropText,
                            fontSize: '1.25rem'
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
                        <ListItem icon={<MdTerminal size={24} />} onClick={() => props.onPush?.(<DevView />)}>
                            開発者ツール
                        </ListItem>
                        <ListItem icon={<MdBadge size={24} />} onClick={() => props.onPush?.(<IDView />)}>
                            ID管理
                        </ListItem>
                        <ListItem icon={<SiActivitypub size={24} />} onClick={() => props.onPush?.(<Activitypub />)}>
                            ActivityPub
                        </ListItem>
                        <ListItem icon={<MdSettings size={24} />} onClick={() => props.onPush?.(<SettingsView />)}>
                            設定
                        </ListItem>
                    </List>
                </div>
            </div>
        </>
    )
}
