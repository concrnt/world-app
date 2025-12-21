import { useMemo, useState } from "react"
import { HomeView } from "./Home"
import { SettingsView } from "./Settings"
import { FAB } from "../ui/FAB"
import { Composer } from "../components/Composer"
import { TabLayout } from "../layouts/Tab"
import { DevView } from "./Dev"
import { SidebarLayout } from "../layouts/Sidebar"

export const MainView = () => {

    const [showComposer, setShowComposer] = useState(false);

    const tabs = useMemo(() => {
        return {
            home: {
                body: <HomeView />,
                icon: <span>🏠</span>,
            },
            dev: {
                body: <DevView />,
                icon: <span>👨‍💻</span>,
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
        <SidebarLayout
            content={
                <div
                    style={{
                        width: "100%",
                        height: "100%",
                        backgroundColor: "purple",
                    }}
                >
                    hogehoge
                </div>
            }
        >
            <TabLayout
                tabs={tabs}
            />
        </SidebarLayout>
    </>

}

