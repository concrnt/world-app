import { useMemo, useState } from "react"
import { TabView } from "../components/TabView"
import { HomeView } from "./Home"
import { SettingsView } from "./Settings"
import { FAB } from "../ui/FAB"
import { Composer } from "../components/Composer"

export const MainView = () => {

    const [showComposer, setShowComposer] = useState(false);

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
        { showComposer && 
            <Composer 
                onClose={() => setShowComposer(false)}
            /> 
        }
        <FAB 
            onClick={() => setShowComposer(true)}
        >
            +
        </FAB>
        <TabView 
            tabs={tabs}
        />
    </>

}

