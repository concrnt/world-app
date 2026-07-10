import { useClient } from '../contexts/Client'

import { ListItem, Divider, Text, useTheme, List, Avatar } from '@concrnt/ui'

import { MdPerson } from 'react-icons/md'
import { MdSettings } from 'react-icons/md'
import { MdTravelExplore } from 'react-icons/md'
import { MdList } from 'react-icons/md'

import { CssVar } from '../types/Theme'

import { SwitchAccountButton } from './SwitchAccountButton'
import { ProfileName } from './ProfileName'
import { useNavigate } from 'react-router-dom'

interface Props {
    onClose?: () => void
}

// モバイル幅のドロワーの中身。app/src/components/Sidebar.tsx のミラー
// (ボトムタブと重複するホーム/通知等は持たず、プロフィール/リスト/照会/設定に絞る)
export const DrawerMenu = (props: Props) => {
    const theme = useTheme()
    const { client } = useClient()
    const navigate = useNavigate()

    const go = (path: string) => {
        navigate(path)
        props.onClose?.()
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
                        dense
                        disablePadding
                        style={{
                            color: CssVar.backdropText
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
                        <ListItem icon={<MdSettings size={24} />} onClick={() => go('/settings')}>
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
                        <br />
                        <a
                            style={{
                                color: CssVar.backdropText,
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
                                color: CssVar.backdropText,
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
                                color: CssVar.backdropText,
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
