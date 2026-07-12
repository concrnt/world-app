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

export const MainView = () => {
    const [opened, setOpen] = useState(false)
    const { client } = useClient()

    const stackRefs = useRef<Record<string, StackLayoutRef | null>>({})
    const scrollRefs = useRef<Record<string, ScrollViewHandle | null>>({})

    const theme = useTheme()

    // TODO: 通知バッジはOS側のバッジと同期する必要があるため、rust側で状態管理が必要
    // const [hasNewNotification, setHasNewNotification] = useState(false)

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
                // TODO: 通知バッジはOS側のバッジと同期する必要があるため、rust側で状態管理が必要
                // tab: (
                //     <div style={{ position: 'relative', display: 'inline-flex' }}>
                //         <MdNotifications size={24} />
                //         {hasNewNotification && (
                //             <div
                //                 style={{
                //                     position: 'absolute',
                //                     top: -2,
                //                     right: -2,
                //                     width: 8,
                //                     height: 8,
                //                     borderRadius: '50%',
                //                     backgroundColor: '#ff4444'
                //                 }}
                //             />
                //         )}
                //     </div>
                // )
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
                        tabs={tabs}
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
