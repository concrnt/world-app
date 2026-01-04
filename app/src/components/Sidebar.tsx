import { useTheme } from '../contexts/Theme'
import { useClient } from '../contexts/Client'

import { ListItem } from '../ui/ListItem'
import { Divider } from '../ui/Divider'
import { Text } from '../ui/Text'
import { Avatar } from '../ui/Avatar'

import { SettingsView } from '../views/Settings'
import { DevView } from '../views/Dev'
import { ProfileView } from '../views/Profile'

import { MdPerson } from 'react-icons/md'
import { MdTerminal } from 'react-icons/md'
import { MdSettings } from 'react-icons/md'
import { ReactNode } from 'react'

interface Props {
    onPush?: (view: ReactNode) => void
}

export const Sidebar = (props: Props) => {
    const theme = useTheme()
    const { client } = useClient()

    return (
        <div
            style={{
                width: '100%',
                height: '100%',
                backgroundColor: theme.ui.background,
                color: theme.ui.text,
                display: 'flex',
                padding: '16px',
                paddingTop: 'env(safe-area-inset-top)',
                paddingBottom: 'env(safe-area-inset-bottom)',
                flexDirection: 'column',
                gap: '16px'
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
                <ListItem icon={<MdTerminal size={24} />} onClick={() => props.onPush?.(<DevView />)}>
                    開発者ツール
                </ListItem>
                <ListItem icon={<MdSettings size={24} />} onClick={() => props.onPush?.(<SettingsView />)}>
                    設定
                </ListItem>
            </div>
        </div>
    )
}
