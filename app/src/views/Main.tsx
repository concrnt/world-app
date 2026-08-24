import { ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { TabLayout } from '../layouts/Tab'
import { SidebarLayout } from '../layouts/Sidebar'
import { Sidebar } from '../components/Sidebar'

import { HomeView } from './Home'
import { ExplorerView } from './Explorer'
import { NotificationsView } from './Notifications'
import { ContactsView } from './Contacts'
import { PostView } from './Post'
import { TimelineView } from './Timeline'
import { ProfileView } from './Profile'
import { ApView } from './ApView'
import { BskyView } from './BskyView'
import { useClient } from '../contexts/Client'
import { useBackHandler } from '../contexts/BackHandler'
import { getLaunchNotification, getPushSchemas, isPushEnabled, onNotificationTapped, registerPush } from '../lib/push'

import { MdHome } from 'react-icons/md'
import { MdExplore } from 'react-icons/md'
import { MdNotifications } from 'react-icons/md'
import { MdContacts } from 'react-icons/md'
import { StackLayout, StackLayoutRef } from '../layouts/Stack'
import { ScrollViewHandle } from '../types/ScrollView'
import { CssVar } from '../types/Theme'
import { Badge, CfmActionsProvider, useCfmActions, useTheme } from '@concrnt/ui'
import { useNotificationCounter } from '../hooks/useNotificationCounter'
import { setAppBadge } from '../lib/push'

export const MainView = () => {
    const [opened, setOpen] = useState(false)
    const { client } = useClient()

    const stackRefs = useRef<Record<string, StackLayoutRef | null>>({})
    const scrollRefs = useRef<Record<string, ScrollViewHandle | null>>({})

    const theme = useTheme()

    // 未読通知数はサーバーのカウンターが正(web/appで同期)。タブバッジとOSバッジの両方に使う。
    // 起動/復帰時の再取得や他端末でのリセットで値が変わるたびにアイコンバッジも追従させる
    const unreadCount = useNotificationCounter(client)
    useEffect(() => {
        if (!client) return
        setAppBadge(unreadCount)
    }, [client, unreadCount])

    const tabs = useMemo(() => {
        return {
            home: {
                body: (
                    <StackLayout
                        ref={(el) => {
                            stackRefs.current['home'] = el
                        }}
                    >
                        <HomeView
                            ref={(el) => {
                                scrollRefs.current['home'] = el
                            }}
                        />
                    </StackLayout>
                ),
                tab: <MdHome size={24} />
            },
            explorer: {
                body: (
                    <StackLayout
                        ref={(el) => {
                            stackRefs.current['explorer'] = el
                        }}
                    >
                        <ExplorerView />
                    </StackLayout>
                ),
                tab: <MdExplore size={24} />
            },
            notifications: {
                body: (
                    <StackLayout
                        ref={(el) => {
                            stackRefs.current['notifications'] = el
                        }}
                    >
                        <NotificationsView />
                    </StackLayout>
                ),
                tab: <MdNotifications size={24} />
            },
            contacts: {
                body: (
                    <StackLayout
                        ref={(el) => {
                            stackRefs.current['contacts'] = el
                        }}
                    >
                        <ContactsView />
                    </StackLayout>
                ),
                tab: <MdContacts size={24} />
            }
        }
    }, [])

    const [selectedTab, setSelectedTab] = useState<string>('home')

    const selectTab = useCallback(
        (tab: string) => {
            if (tab === selectedTab) {
                if (!stackRefs.current[tab]?.clear()) {
                    const handle = scrollRefs.current[tab]
                    if (handle?.reselect) handle.reselect()
                    else handle?.scrollToTop()
                }
            }
            setSelectedTab(tab)
        },
        [selectedTab]
    )

    // openInternalはCfmActionsとしてメモ化して配るため、押し先のタブはrefで最新値を追う
    const selectedTabRef = useRef(selectedTab)
    useEffect(() => {
        selectedTabRef.current = selectedTab
    }, [selectedTab])

    const parentCfmActions = useCfmActions()

    // concrnt.worldオリジンの共有URLは外部ブラウザに出さず、対応するビューを現在のタブのスタックに積む
    const openInternal = useCallback((url: string): boolean => {
        let parsed: URL
        try {
            parsed = new URL(url)
        } catch {
            return false
        }
        if (parsed.hostname !== 'concrnt.world') return false
        const path = parsed.pathname
        let view: ReactNode | null = null
        let match: RegExpMatchArray | null
        if ((match = path.match(/^\/post\/([^/]+)$/))) {
            view = <PostView uri={decodeURIComponent(match[1])} />
        } else if ((match = path.match(/^\/timeline\/([^/]+)$/))) {
            view = <TimelineView uri={decodeURIComponent(match[1])} />
        } else if ((match = path.match(/^\/profile\/([^/]+)(?:\/([^/]+))?$/))) {
            view = (
                <ProfileView
                    ccid={decodeURIComponent(match[1])}
                    profileName={match[2] ? decodeURIComponent(match[2]) : undefined}
                />
            )
        } else if ((match = path.match(/^\/activitypub\/(?:person|note|view)\/([^/]+)$/))) {
            view = <ApView uri={decodeURIComponent(match[1])} />
        } else if ((match = path.match(/^\/bluesky\/(?:person|post|view)\/([^/]+)$/))) {
            view = <BskyView uri={decodeURIComponent(match[1])} />
        }
        if (!view) return false
        stackRefs.current[selectedTabRef.current]?.push(view)
        return true
    }, [])

    const cfmActions = useMemo(
        () => ({
            ...parentCfmActions,
            openInternal
        }),
        [parentCfmActions, openInternal]
    )

    // Android back button handling: ナビゲーションハンドラは常時登録(=スタックの最下段)
    useBackHandler(() => {
        const stackRef = stackRefs.current[selectedTab]
        if (stackRef && stackRef.pop()) {
            return true
        }
        if (selectedTab !== 'home') {
            setSelectedTab('home')
            return true
        }
        return false
    })

    // Push notifications: re-upsert the subscription on every app start (the
    // cheapest way to keep the native token fresh across rotations), surface
    // a cold-start tap's deep link once, and listen for warm-start taps.
    useEffect(() => {
        if (!client) return

        if (isPushEnabled()) {
            registerPush(client, getPushSchemas()).catch((err) => {
                console.error('failed to re-register push subscription', err)
            })
        }

        const navigate = (payload: { uri: string | null; view: string | null }) => {
            setSelectedTab('notifications')
            if (payload.view === 'post' && payload.uri) {
                stackRefs.current['notifications']?.push(<PostView uri={payload.uri} />)
            }
        }

        getLaunchNotification()
            .then((payload) => {
                if (payload.view) navigate(payload)
            })
            .catch(() => {})

        let listener: { unregister: () => void } | undefined
        onNotificationTapped(navigate)
            .then((l) => {
                listener = l
            })
            .catch(() => {})

        return () => {
            listener?.unregister()
        }
    }, [client])

    return (
        <CfmActionsProvider value={cfmActions}>
            <SidebarLayout
                opened={opened}
                setOpen={setOpen}
                content={
                    <Sidebar
                        onPush={(view) => {
                            console.log('pushing view to tab:', selectedTab)
                            const stackRef = stackRefs.current[selectedTab]
                            stackRef?.set(view)
                            setOpen(false)
                        }}
                    />
                }
            >
                <div
                    style={{
                        width: '100%',
                        height: '100%',
                        backgroundColor: CssVar.backdropBackground
                    }}
                >
                    <TabLayout
                        selectedTab={selectedTab}
                        setSelectedTab={selectTab}
                        tabs={{
                            ...tabs,
                            notifications: {
                                ...tabs.notifications,
                                tab: (
                                    <Badge
                                        count={unreadCount}
                                        style={{
                                            backgroundColor: CssVar.backdropText,
                                            color: CssVar.backdropBackground
                                        }}
                                    >
                                        {tabs.notifications.tab}
                                    </Badge>
                                )
                            }
                        }}
                        style={{
                            paddingBottom: 'env(safe-area-inset-bottom)',
                            borderTop: theme.variant === 'classic' ? `1px solid ${CssVar.divider}` : undefined
                        }}
                        tabStyle={{
                            color: CssVar.backdropText
                        }}
                    />
                </div>
            </SidebarLayout>
        </CfmActionsProvider>
    )
}
