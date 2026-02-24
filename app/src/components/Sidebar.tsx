import { ReactNode } from 'react'

import { useTheme } from '../contexts/Theme'
import { useClient } from '../contexts/Client'

import { ListItem } from '../ui/ListItem'
import { Divider } from '../ui/Divider'
import { Text } from '../ui/Text'
import { Avatar } from '../ui/Avatar'

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
import { CssVar } from '../types/Theme'

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
                        padding: '16px',
                        flexDirection: 'column',
                        gap: '16px',
                        height: '100%',
                        borderRadius: '0 8px 8px 0'
                    }}
                >
                    <div
                        style={{
                            display: 'flex',
                            flexDirection: 'column',
                            justifyContent: 'center'
                        }}
                        onClick={() => props.onPush?.(<ProfileView id={client?.ccid || ''} />)}
                    >
                        <Avatar ccid={client?.ccid || ''} src={client?.user?.profile.avatar} />
                        <Text variant="h2">{client?.user?.profile.username || 'Unknown User'}</Text>
                        <Text variant="caption">{client?.server.domain || 'Unknown Server'}</Text>
                    </div>
                    <Divider />
                    <div
                        style={{
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '16px',
                            overflowY: 'auto'
                        }}
                    >
                        <ListItem
                            icon={<MdPerson size={24} />}
                            onClick={() => props.onPush?.(<ProfileView id={client?.ccid || ''} />)}
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
                        <ListItem icon={<MdSettings size={24} />} onClick={() => props.onPush?.(<SettingsView />)}>
                            設定
                        </ListItem>
                    </div>
                </div>
            </div>
        </>
    )
}
