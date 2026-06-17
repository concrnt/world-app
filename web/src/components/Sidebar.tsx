import { useClient } from '../contexts/Client'

import { Avatar, ListItem, Divider, Text, useTheme, List, Button } from '@concrnt/ui'

import { MdHome } from 'react-icons/md'
import { MdExplore } from 'react-icons/md'
import { MdNotifications } from 'react-icons/md'
import { MdContacts } from 'react-icons/md'
import { MdSettings } from 'react-icons/md'
import { MdTravelExplore } from 'react-icons/md'
import { MdList } from 'react-icons/md'
import { MdCreate } from 'react-icons/md'

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
                        color: CssVar.backdropText,
                        display: 'flex',
                        padding: CssVar.space(2),
                        flexDirection: 'column',
                        gap: CssVar.space(1),
                        height: '100%'
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
                        dense
                        disablePadding
                        style={{
                            color: CssVar.backdropText
                        }}
                    >
                        <ListItem icon={<MdHome size={24} />} onClick={() => go('/')}>
                            ホーム
                        </ListItem>
                        <ListItem icon={<MdNotifications size={24} />} onClick={() => go('/notifications')}>
                            通知
                        </ListItem>
                        <ListItem icon={<MdContacts size={24} />} onClick={() => go('/contacts')}>
                            コンタクト
                        </ListItem>
                        <ListItem icon={<MdExplore size={24} />} onClick={() => go('/explorer')}>
                            探索
                        </ListItem>
                        <ListItem icon={<MdList size={24} />} onClick={() => go('/lists')}>
                            リスト
                        </ListItem>
                        <ListItem icon={<MdTravelExplore size={24} />} onClick={() => go('/query')}>
                            照会
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

                    <Divider
                        style={{
                            marginTop: CssVar.space(2)
                        }}
                    />

                    <div
                        style={{
                            fontSize: '0.6rem',
                            padding: CssVar.space(1),
                            textAlign: 'center'
                        }}
                    >
                        Concrnt World App 開発中α版
                        <br />
                        <a
                            style={{
                                color: CssVar.uiText,
                                textDecoration: 'none'
                            }}
                            href="https://square.concrnt.net/"
                            target="_blank"
                            rel="noreferrer"
                        >
                            ドキュメント
                        </a>
                        {' / '}
                        <a
                            style={{
                                color: CssVar.uiText,
                                textDecoration: 'none'
                            }}
                            href="https://github.com/orgs/concrnt/discussions"
                            target="_blank"
                            rel="noreferrer"
                        >
                            フォーラム
                        </a>
                        {' / '}
                        <a
                            style={{
                                color: CssVar.uiText,
                                textDecoration: 'none'
                            }}
                            href="https://github.com/totegamma/concurrent-world"
                            target="_blank"
                            rel="noreferrer"
                        >
                            GitHub
                        </a>
                    </div>
                </div>
            </div>
        </>
    )
}
