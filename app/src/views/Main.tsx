import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
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
import { ListView } from './List'
import { ApView } from './ApView'
import { BskyView } from './BskyView'
import { QueryView } from './Query'
import { useClient } from '../contexts/Client'
import { useBackHandler } from '../contexts/BackHandler'
import { getLaunchNotification, getPushSchemas, isPushEnabled, onNotificationTapped, registerPush } from '../lib/push'
import { getLaunchDeepLink, onDeepLink } from '../lib/deeplink'
import { AUTH_URI_SCHEME } from '../lib/externalAuth'
import { ExternalAuthView } from './ExternalAuth'
import { resolveQueryTarget } from '../lib/query'

import { MdHome } from 'react-icons/md'
import { MdExplore } from 'react-icons/md'
import { MdNotifications } from 'react-icons/md'
import { MdContacts } from 'react-icons/md'
import { StackLayout, StackLayoutRef } from '../layouts/Stack'
import { ScrollViewHandle } from '../types/ScrollView'
import { CssVar } from '../types/Theme'
import { Badge, useTheme } from '@concrnt/ui'
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

    // ディープリンク等のeffect内から押し先のタブを参照するため、refで最新値を追う
    const selectedTabRef = useRef(selectedTab)
    useEffect(() => {
        selectedTabRef.current = selectedTab
    }, [selectedTab])

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
    // cheapest way to keep the native token fresh across rotations), then
    // drain the native tap buffer once on mount (cold start, or a tap that
    // arrived while nobody was listening) and again on every warm-start tap
    // signal. See getLaunchNotification for the buffer contract.
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

    // OSからのdeep link(cckv:// / concrnt-auth://)とサイドバーのQRスキャン結果は同じ入口で振り分ける:
    //   concrnt-auth://(CIP-17 / signal)または wss://(webログイン画面の旧signal QR)→ 同意画面
    //   それ以外(cckv:// / CCID / https://concrnt.world/... / manifest URL)→ 照会と同じ解決で該当ビュー
    //   解決できなければ照会画面に入れた状態で開き、失敗理由をそこで見せる
    const openDeepLink = useCallback(
        (uri: string) => {
            if (!client) return
            setOpen(false)
            const stack = stackRefs.current[selectedTabRef.current]
            if (uri.startsWith(AUTH_URI_SCHEME) || uri.startsWith('wss://')) {
                stack?.push(<ExternalAuthView uri={uri} />)
                return
            }
            resolveQueryTarget(client, uri)
                .then((target) => {
                    switch (target.kind) {
                        case 'profile':
                            stack?.push(
                                <ProfileView ccid={target.ccid} profileName={target.profileName} hint={target.hint} />
                            )
                            break
                        case 'post':
                            stack?.push(<PostView uri={target.uri} />)
                            break
                        case 'timeline':
                            stack?.push(<TimelineView uri={target.uri} />)
                            break
                        case 'list':
                            stack?.push(<ListView uri={target.uri} />)
                            break
                        case 'apView':
                            stack?.push(<ApView uri={target.uri} />)
                            break
                        case 'bskyView':
                            stack?.push(<BskyView uri={target.uri} />)
                            break
                    }
                })
                .catch(() => {
                    stack?.push(<QueryView initialQuery={uri} autoSubmit />)
                })
        },
        [client]
    )

    // Cold start: the URL is held by the plugin until MainView mounts (i.e.
    // after login), so it is consumed here once. Warm start: live event.
    useEffect(() => {
        if (!client) return

        getLaunchDeepLink()
            .then((url) => {
                if (url) openDeepLink(url)
            })
            .catch(() => {})

        let unlisten: (() => void) | undefined
        let cancelled = false
        onDeepLink(openDeepLink)
            .then((f) => {
                if (cancelled) f()
                else unlisten = f
            })
            .catch(() => {})

        return () => {
            cancelled = true
            unlisten?.()
        }
    }, [client, openDeepLink])

    return (
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
                    onScanned={openDeepLink}
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
                        borderTop: theme.variant === 'classic' ? `1px solid ${CssVar.divider}` : undefined,
                        borderBottom: 'none'
                    }}
                    tabStyle={{
                        color: CssVar.backdropText,
                        padding: '0.5rem'
                    }}
                />
            </div>
        </SidebarLayout>
    )
}
