import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { TabLayout } from '../layouts/Tab'
import { SidebarLayout } from '../layouts/Sidebar'
import { Sidebar } from '../components/Sidebar'

import { HomeView } from './Home'
import { ExplorerView } from './Explorer'
import { NotificationsView } from './Notifications'
import { ContactsView } from './Contacts'

import { MdHome } from 'react-icons/md'
import { MdExplore } from 'react-icons/md'
import { MdNotifications } from 'react-icons/md'
import { MdContacts } from 'react-icons/md'
import { ScrollViewHandle } from '../types/ScrollView'
import { CssVar } from '../types/Theme'
import { useTheme } from '@concrnt/ui'

export const MainView = () => {
    const [opened, setOpen] = useState(false)

    const scrollRefs = useRef<Record<string, ScrollViewHandle | null>>({})

    const theme = useTheme()

    const tabs = useMemo(() => {
        return {
            home: {
                body: (
                    <HomeView
                        ref={(el) => {
                            scrollRefs.current['home'] = el
                        }}
                    />
                ),
                tab: <MdHome size={24} />
            },
            explorer: {
                body: <ExplorerView />,
                tab: <MdExplore size={24} />
            },
            notifications: {
                body: <NotificationsView />,
                tab: <MdNotifications size={24} />
            },
            contacts: {
                body: <ContactsView />,
                tab: <MdContacts size={24} />
            }
        }
    }, [])

    const [selectedTab, setSelectedTab] = useState<string>('home')

    const selectTab = useCallback(
        (tab: string) => {
            if (tab === selectedTab) {
                scrollRefs.current[tab]?.scrollToTop()
            }
            setSelectedTab(tab)
        },
        [selectedTab]
    )

    useEffect(() => {
        ;(window as any).__concrntHandleBack = (): boolean => {
            if (selectedTab !== 'home') {
                setSelectedTab('home')
                return true
            }
            return false
        }
        return () => {
            delete (window as any).__concrntHandleBack
        }
    }, [selectedTab])

    return (
        <>
            <SidebarLayout
                opened={opened}
                setOpen={setOpen}
                content={<Sidebar onPush={() => setOpen(false)} />}
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
