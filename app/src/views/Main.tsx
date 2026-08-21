import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { TabLayout } from '../layouts/Tab'
import { SidebarLayout } from '../layouts/Sidebar'
import { Sidebar } from '../components/Sidebar'

import { HomeView } from './Home'
import { ExplorerView } from './Explorer'
import { NotificationsView } from './Notifications'
import { ContactsView } from './Contacts'
import { PostView } from './Post'
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
import { useTheme } from '@concrnt/ui'
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
                    scrollRefs.current[tab]?.scrollToTop()
                }
            }
            setSelectedTab(tab)
        },
        [selectedTab]
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
        <>
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
                        tabs={{ ...tabs, notifications: { ...tabs.notifications, badge: unreadCount } }}
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
        </>
    )
}
