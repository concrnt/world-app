import { Activity, ReactNode, useState } from "react";

interface Tab {
    body: ReactNode
    icon: ReactNode
}

interface Props {
    tabs: Record<string, Tab>;
}

export const TabView = (props: Props) => {

    const [selectedTab, setSelectedTab] = useState<string>(Object.keys(props.tabs)[0]);

    return <div
        style={{ 
            width: "100%",
            height: "100%",
            display: "flex",
            flexDirection: "column",
            backgroundColor: "yellow",
        }}
    >
        {Object.entries(props.tabs).map(([key, tab]) => (
            <Activity mode={key === selectedTab ? "visible" : "hidden"} key={key}>
                {tab.body}
            </Activity>
        ))}
        <div style={{ 
            display: "flex", 
            justifyContent: "space-around", 
            marginTop: "1rem",
            backgroundColor: "red",
        }}>
            {Object.entries(props.tabs).map(([key, tab]) => (
                <div
                    key={key}
                    onClick={() => setSelectedTab(key)}
                    style={{
                        cursor: "pointer",
                        padding: "0.5rem",
                        borderBottom: key === selectedTab ? "2px solid blue" : "2px solid transparent"
                    }}
                >
                    {tab.icon}
                </div>
            ))}
        </div>
    </div>
}

