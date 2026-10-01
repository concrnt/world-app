import { useTranslation } from 'react-i18next'
import { useClient } from '../contexts/Client'
import { useDomainStatus } from '../hooks/useDomainStatus'

import { Avatar, Badge, ListItem, Divider, Text, useTheme, List, Button, ExternalLink } from '@concrnt/ui'

import { GoHomeFill } from 'react-icons/go'
import { HiBell } from 'react-icons/hi'
import { BsPeopleFill } from 'react-icons/bs'
import { FaListUl } from 'react-icons/fa6'
import { MdExplore } from 'react-icons/md'
import { MdSettings } from 'react-icons/md'
import { MdTravelExplore } from 'react-icons/md'
import { MdCreate } from 'react-icons/md'

import { CssVar } from '../types/Theme'

import { SwitchAccountButton } from './SwitchAccountButton'
import { ConnectionStatus } from './ConnectionStatus'
import { ProfileName } from './ProfileName'
import { SidebarLists } from './SidebarLists'
import { useLocation, useNavigate } from 'react-router-dom'
import { useComposer } from '../contexts/Composer'
import { useNotificationCounter } from '../hooks/useNotificationCounter'
import { currentPostContext } from '../contexts/PostContext'

const NAV = [
    { path: '/', key: 'home', icon: <GoHomeFill size={22} /> },
    { path: '/notifications', key: 'notifications', icon: <HiBell size={22} /> },
    { path: '/contacts', key: 'contacts', icon: <BsPeopleFill size={22} /> },
    { path: '/explorer', key: 'explore', icon: <MdExplore size={22} /> },
    { path: '/lists', key: 'lists', icon: <FaListUl size={22} /> },
    { path: '/query', key: 'query', icon: <MdTravelExplore size={22} /> },
    { path: '/settings', key: 'settings', icon: <MdSettings size={22} /> }
] as const

export const Sidebar = () => {
    const { t } = useTranslation('', { keyPrefix: 'components.sidebar' })
    const theme = useTheme()
    const { client } = useClient()
    const homeStatus = useDomainStatus()
    const unreadCount = useNotificationCounter(client)
    const navigate = useNavigate()
    const location = useLocation()
    const composer = useComposer()

    const go = (path: string) => {
        navigate(path)
    }

    const isActive = (path: string) => (path === '/' ? location.pathname === '/' : location.pathname.startsWith(path))

    return (
        <>
            <div
                style={{
                    width: '100%',
                    height: '100%',
                    boxSizing: 'border-box',
                    paddingTop: 'env(safe-area-inset-top)',
                    paddingBottom: 'env(safe-area-inset-bottom)',
                    backgroundColor: theme.variant === 'classic' ? CssVar.backdropBackground : 'transparent',
                    color: CssVar.backdropText,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: CssVar.space(6)
                }}
            >
                <div
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: CssVar.space(3),
                        padding: CssVar.space(3),
                        borderRadius: CssVar.round(3),
                        backgroundColor: `rgb(from ${CssVar.backdropText} r g b / 0.06)`,
                        cursor: 'pointer'
                    }}
                    onClick={() => go(`/profile/${client?.ccid || ''}/${client?.currentProfile ?? 'main'}`)}
                >
                    <Avatar ccid={client?.ccid || ''} src={client?.profile.avatar} />
                    <div
                        style={{
                            flex: 1,
                            minWidth: 0,
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 0
                        }}
                    >
                        <Text
                            style={{
                                fontWeight: 700,
                                lineHeight: 1.2,
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap'
                            }}
                        >
                            <ProfileName document={client?.profileDocument} />
                        </Text>
                        <Text
                            variant="caption"
                            style={{
                                fontSize: '0.75rem',
                                lineHeight: 1.2,
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap'
                            }}
                        >
                            {client?.server.domain || 'Unknown Server'}
                        </Text>
                    </div>
                    <SwitchAccountButton />
                </div>
                {!homeStatus.online && (
                    <div style={{ padding: `0 ${CssVar.space(2)}` }}>
                        <ConnectionStatus />
                    </div>
                )}
                <List
                    disablePadding
                    style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '2px',
                        color: CssVar.backdropText
                    }}
                >
                    {NAV.map((item) => {
                        const active = isActive(item.path)
                        return (
                            <ListItem
                                key={item.path}
                                icon={item.icon}
                                endIcon={
                                    item.path === '/notifications' ? (
                                        <Badge
                                            style={{
                                                color: CssVar.backdropBackground,
                                                backgroundColor: CssVar.backdropText
                                            }}
                                            count={unreadCount}
                                        />
                                    ) : undefined
                                }
                                onClick={() => go(item.path)}
                                style={{
                                    position: 'relative',
                                    overflow: 'hidden',
                                    borderRadius: CssVar.round(2),
                                    backgroundColor: active
                                        ? `rgb(from ${CssVar.backdropText} r g b / 0.08)`
                                        : 'transparent',
                                    fontWeight: active ? 700 : 400,
                                    transition: 'background-color 0.15s'
                                }}
                            >
                                <span style={{ paddingLeft: CssVar.space(1) }}>{t(item.key)}</span>
                            </ListItem>
                        )
                    })}
                </List>
                <div
                    style={{
                        flex: 1,
                        minHeight: 0,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: CssVar.space(2)
                    }}
                >
                    <Divider
                        style={{
                            margin: `0 ${CssVar.space(2)}`,
                            borderColor: `rgb(from ${CssVar.backdropText} r g b / 0.12)`
                        }}
                    />
                    <SidebarLists />
                </div>
                <div
                    style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: CssVar.space(4)
                    }}
                >
                    <Button
                        onClick={() => {
                            // 最前面のビューが提供するデフォルト投稿先で開く。文脈のないページではホームのみ
                            const postCtx = currentPostContext()
                            composer.open(postCtx.destinations, undefined, undefined, undefined, postCtx.profile)
                        }}
                        style={{
                            width: '100%',
                            minHeight: '48px',
                            borderRadius: CssVar.round(3),
                            fontSize: '1rem',
                            fontWeight: 700,
                            gap: CssVar.space(2)
                        }}
                    >
                        <MdCreate size={20} />
                        {t('post')}
                    </Button>

                    <div
                        style={{
                            fontSize: '0.7rem',
                            lineHeight: 1.8,
                            opacity: 0.6,
                            textAlign: 'center'
                        }}
                    >
                        Concrnt World App
                        <br />
                        <ExternalLink
                            style={{
                                color: CssVar.backdropText,
                                textDecoration: 'none'
                            }}
                            href="https://square.concrnt.net/"
                        >
                            {t('documentation')}
                        </ExternalLink>
                        {' · '}
                        <ExternalLink
                            style={{
                                color: CssVar.backdropText,
                                textDecoration: 'none'
                            }}
                            href="https://github.com/orgs/concrnt/discussions"
                        >
                            {t('forum')}
                        </ExternalLink>
                        {' · '}
                        <ExternalLink
                            style={{
                                color: CssVar.backdropText,
                                textDecoration: 'none'
                            }}
                            href="https://github.com/totegamma/concurrent-world"
                        >
                            GitHub
                        </ExternalLink>
                    </div>
                </div>
            </div>
        </>
    )
}
