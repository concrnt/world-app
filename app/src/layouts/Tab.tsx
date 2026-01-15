import { Activity, CSSProperties, ReactNode, useId } from 'react'
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
    placement?: 'upper' | 'lower'
}

export const TabLayout = (props: Props) => {
    const tabId = useId()

    return (
        <div
            data-testid="tab-layout"
            style={{
                width: '100%',
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden'
            }}
        >
            {props.placement === 'upper' && (
                <Tabs style={props.tabStyle}>
                    {Object.entries(props.tabs).map(([key, tab]) => (
                        <Tab
                            key={key}
                            groupId={tabId}
                            onClick={() => props.setSelectedTab(key)}
                            selected={key === props.selectedTab}
                        >
                            {tab.icon}
                        </Tab>
                    ))}
                </Tabs>
            )}

            {Object.entries(props.tabs).map(([key, tab]) => (
                <Activity mode={key === props.selectedTab ? 'visible' : 'hidden'} key={key}>
                    {tab.body}
                </Activity>
            ))}

            {props.placement !== 'upper' && (
                <Tabs style={props.tabStyle}>
                    {Object.entries(props.tabs).map(([key, tab]) => (
                        <Tab key={key} onClick={() => props.setSelectedTab(key)} selected={key === props.selectedTab}>
                            {tab.icon}
                        </Tab>
                    ))}
                </Tabs>
            )}
        </div>
    )
}
