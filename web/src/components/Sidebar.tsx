import { useClient } from '../contexts/Client'

import { ListItem, Divider, Text, useTheme, List, Button } from '@concrnt/ui'
import { Avatar } from '@concrnt/ui'

import { MdPerson } from 'react-icons/md'
import { MdHome } from 'react-icons/md'
import { MdExplore } from 'react-icons/md'
import { MdNotifications } from 'react-icons/md'
import { MdContacts } from 'react-icons/md'
import { MdTerminal } from 'react-icons/md'
import { MdSettings } from 'react-icons/md'
import { MdTravelExplore } from 'react-icons/md'
import { MdList } from 'react-icons/md'
import { MdBadge } from 'react-icons/md'
import { MdCreate } from 'react-icons/md'
import { SiActivitypub } from 'react-icons/si'

import { CssVar } from '../types/Theme'

import { SwitchAccountButton } from './SwitchAccountButton'
import { ProfileName } from './ProfileName'
import { useNavigate } from 'react-router-dom'
import { useComposer } from '../contexts/Composer'
import { semantics } from '@concrnt/worldlib'

export const Sidebar = () => {
    const theme = useTheme()
    const { client } = useClient()
    const navigate = useNavigate()
    const composer = useComposer()

    const go = (path: string) => {
        navigate(path)
    }

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
                        onClick={() => go(`/profile/${client?.ccid || ''}/${client?.currentProfile ?? 'main'}`)}
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
                        style={{
                            color: CssVar.backdropText,
                            fontSize: '1.25rem'
                        }}
                    >
                        <ListItem icon={<MdHome size={24} />} onClick={() => go('/')}>
                            ホーム
                        </ListItem>
                        <ListItem icon={<MdExplore size={24} />} onClick={() => go('/explorer')}>
                            エクスプローラー
                        </ListItem>
                        <ListItem icon={<MdNotifications size={24} />} onClick={() => go('/notifications')}>
                            通知
                        </ListItem>
                        <ListItem icon={<MdContacts size={24} />} onClick={() => go('/contacts')}>
                            コンタクト
                        </ListItem>
                    </List>
                    <Divider />
                    <List
                        style={{
                            color: CssVar.backdropText,
                            fontSize: '1.25rem'
                        }}
                    >
                        <ListItem
                            icon={<MdPerson size={24} />}
                            onClick={() => go(`/profile/${client?.ccid || ''}/${client?.currentProfile ?? 'main'}`)}
                        >
                            プロフィール
                        </ListItem>
                        <ListItem icon={<MdList size={24} />} onClick={() => go('/lists')}>
                            リスト
                        </ListItem>
                        <ListItem icon={<MdTravelExplore size={24} />} onClick={() => go('/query')}>
                            照会
                        </ListItem>
                        <ListItem icon={<MdTerminal size={24} />} onClick={() => go('/dev')}>
                            開発者ツール
                        </ListItem>
                        <ListItem icon={<MdBadge size={24} />} onClick={() => go('/id')}>
                            ID管理
                        </ListItem>
                        <ListItem icon={<SiActivitypub size={24} />} onClick={() => go('/activitypub')}>
                            ActivityPub
                        </ListItem>
                        <ListItem icon={<MdSettings size={24} />} onClick={() => go('/settings')}>
                            設定
                        </ListItem>
                    </List>
                    <div style={{ flex: 1 }} />
                    <Button
                        onClick={() => {
                            const home = semantics.homeTimeline(client.ccid, client.currentProfile)
                            composer.open([home])
                        }}
                        style={{ width: '100%' }}
                    >
                        <MdCreate size={20} />
                        投稿
                    </Button>
                </div>
            </div>
        </>
    )
}
