import { Activity, CSSProperties, ReactNode } from 'react'
import { Tabs } from '../ui/Tabs'
import { Tab } from '../ui/Tab'

interface Tab {
    body: ReactNode
    icon: ReactNode
}

interface Props {
    selectedTab: string
    setSelectedTab: (tab: string) => void
    tabs: Record<string, Tab>
    tabStyle?: CSSProperties
}

export const TabLayout = (props: Props) => {
    return (
        <div
            style={{
                width: '100%',
                height: '100%',
                display: 'flex',
                flexDirection: 'column'
            }}
        >
            <div
                style={{
                    display: 'flex',
                    flex: 1,
                    position: 'relative'
                }}
            >
                {Object.entries(props.tabs).map(([key, tab]) => (
                    <Activity mode={key === props.selectedTab ? 'visible' : 'hidden'} key={key}>
                        {tab.body}
                    </Activity>
                ))}
            </div>
            <Tabs style={props.tabStyle}>
                {Object.entries(props.tabs).map(([key, tab]) => (
                    <Tab key={key} onClick={() => props.setSelectedTab(key)} selected={key === props.selectedTab}>
                        {tab.icon}
                    </Tab>
                ))}
            </Tabs>
        </div>
    )
}
