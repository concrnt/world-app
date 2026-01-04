import { useMemo, useRef, useState } from 'react'
import { FAB } from '../ui/FAB'
import { Composer } from '../components/Composer'
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
import { MdCreate } from 'react-icons/md'
import { StackLayout, StackLayoutRef } from '../layouts/Stack'

export const MainView = () => {
    const [opened, setOpen] = useState(false)
    const [showComposer, setShowComposer] = useState(false)

    const stackRefs = useRef<Record<string, StackLayoutRef | null>>({})

    const tabs = useMemo(() => {
        return {
            home: {
                body: (
                    <StackLayout
                        ref={(el) => {
                            stackRefs.current['home'] = el
                        }}
                    >
                        <HomeView />
                    </StackLayout>
                ),
                icon: <MdHome size={24} />
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
                icon: <MdNotifications size={24} />
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
                icon: <MdExplore size={24} />
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
                icon: <MdContacts size={24} />
            }
        }
    }, [])

    const [selectedTab, setSelectedTab] = useState<string>('home')

    return (
        <>
            {showComposer && <Composer onClose={() => setShowComposer(false)} />}
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
                        height: '100%'
                    }}
                >
                    <TabLayout
                        selectedTab={selectedTab}
                        setSelectedTab={setSelectedTab}
                        tabs={tabs}
                        tabStyle={{
                            paddingBottom: 'env(safe-area-inset-bottom)'
                        }}
                    />
                    <FAB
                        onClick={() => setShowComposer(true)}
                        style={{
                            position: 'absolute',
                            bottom: `calc(4rem + env(safe-area-inset-bottom))`,
                            right: '1rem'
                        }}
                    >
                        <MdCreate size={24} />
                    </FAB>
                </div>
            </SidebarLayout>
        </>
    )
}
