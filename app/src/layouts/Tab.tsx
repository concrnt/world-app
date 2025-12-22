import { Activity, ReactNode, useState } from 'react'
import { StackLayout } from './Stack'
import { Tabs } from '../ui/Tabs'
import { Tab } from '../ui/Tab'

interface Tab {
    body: ReactNode
    icon: ReactNode
}

interface Props {
    tabs: Record<string, Tab>
}

export const TabLayout = (props: Props) => {
    const [selectedTab, setSelectedTab] = useState<string>(Object.keys(props.tabs)[0])

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
                    <Activity mode={key === selectedTab ? 'visible' : 'hidden'} key={key}>
                        <StackLayout>{tab.body}</StackLayout>
                    </Activity>
                ))}
            </div>
            <Tabs>
                {Object.entries(props.tabs).map(([key, tab]) => (
                    <Tab key={key} onClick={() => setSelectedTab(key)} selected={key === selectedTab}>
                        {tab.icon}
                    </Tab>
                ))}
            </Tabs>
        </div>
    )
}
