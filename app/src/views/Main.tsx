import { useMemo, useState } from 'react'
import { HomeView } from './Home'
import { SettingsView } from './Settings'
import { FAB } from '../ui/FAB'
import { Composer } from '../components/Composer'
import { TabLayout } from '../layouts/Tab'
import { DevView } from './Dev'
import { SidebarLayout } from '../layouts/Sidebar'
import { ExplorerView } from './Explorer'
import { NotificationsView } from './Notification'
import { Sidebar } from '../components/Sidebar'

import { MdHome } from 'react-icons/md'
import { MdExplore } from 'react-icons/md'
import { MdNotifications } from 'react-icons/md'
import { MdTerminal } from 'react-icons/md'
import { MdSettings } from 'react-icons/md'
import { MdCreate } from 'react-icons/md'

export const MainView = () => {
    const [showComposer, setShowComposer] = useState(false)

    const tabs = useMemo(() => {
        return {
            home: {
                body: <HomeView />,
                icon: <MdHome size={24} />
            },
            explorer: {
                body: <ExplorerView />,
                icon: <MdExplore size={24} />
            },
            notifications: {
                body: <NotificationsView />,
                icon: <MdNotifications size={24} />
            },
            dev: {
                body: <DevView />,
                icon: <MdTerminal size={24} />
            },
            settings: {
                body: <SettingsView />,
                icon: <MdSettings size={24} />
            }
        }
    }, [])

    return (
        <>
            {showComposer && <Composer onClose={() => setShowComposer(false)} />}
            <SidebarLayout content={<Sidebar />}>
                <TabLayout tabs={tabs} />
                <FAB onClick={() => setShowComposer(true)}>
                    <MdCreate size={24} />
                </FAB>
            </SidebarLayout>
        </>
    )
}
