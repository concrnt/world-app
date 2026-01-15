import { ReactNode, useState } from 'react'

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
import { MdTravelExplore } from 'react-icons/md'
import { Dialog } from '../ui/Dialog'
import { TextField } from '../ui/TextField'
import { Button } from '../ui/Button'
import { TimelineView } from '../views/Timeline'

interface Props {
    onPush?: (view: ReactNode) => void
}

export const Sidebar = (props: Props) => {
    const theme = useTheme()
    const { client } = useClient()

    const [open, setOpen] = useState(false)
    const [query, setQuery] = useState('')

    return (
        <>
            <div
                style={{
                    width: '100%',
                    height: '100%',
                    paddingTop: 'env(safe-area-inset-top)',
                    paddingBottom: 'env(safe-area-inset-bottom)',
                    backgroundColor: theme.variant === 'classic' ? theme.ui.background : 'transparent'
                }}
            >
                <div
                    style={{
                        backgroundColor: theme.ui.background,
                        color: theme.ui.text,
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
                        <ListItem icon={<MdTravelExplore size={24} />} onClick={() => setOpen(true)}>
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
            <Dialog
                open={open}
                onClose={() => setOpen(false)}
                style={{
                    padding: '8px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px'
                }}
            >
                <Text variant="h3">照会</Text>
                <TextField value={query} onChange={(e) => setQuery(e.target.value)} placeholder="cc://" />
                <Button
                    onClick={() => {
                        props.onPush?.(<TimelineView uri={query} />)
                        setOpen(false)
                        setQuery('')
                    }}
                >
                    照会
                </Button>
            </Dialog>
        </>
    )
}
