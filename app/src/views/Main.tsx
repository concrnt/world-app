import { useMemo } from "react"
import { TabView } from "../components/TabView"
import { HomeView } from "./Home"
import { SettingsView } from "./Settings"

export const MainView = () => {

    const tabs = useMemo(() => {
        return {
            home: {
                body: <HomeView />,
                icon: <span>🏠</span>,
            },
            settings: {
                body: <SettingsView />,
                icon: <span>⚙️</span>,
            },
        }
    }, [])

    return <>
        <TabView 
            tabs={tabs}
        />
    </>

}

