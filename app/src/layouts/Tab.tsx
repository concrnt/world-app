import { CSSProperties, ReactNode, useId } from 'react'
import { Tabs } from '../ui/Tabs'
import { Tab } from '../ui/Tab'
import { ActivityProvider } from '../contexts/Activity'

interface Tab {
    body: ReactNode
    tab: ReactNode
}

interface Props {
    selectedTab: string
    setSelectedTab: (tab: string) => void
    tabs: Record<string, Tab>
    tabStyle?: CSSProperties
    style?: CSSProperties
    placement?: 'upper' | 'lower'
    divider?: boolean
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
                <>
                    <Tabs style={props.style}>
                        {Object.entries(props.tabs).map(([key, tab]) => (
                            <Tab
                                key={key}
                                groupId={tabId}
                                onClick={() => props.setSelectedTab(key)}
                                selected={key === props.selectedTab}
                                style={props.tabStyle}
                            >
                                {tab.tab}
                            </Tab>
                        ))}
                    </Tabs>
                    {props.divider && <div style={{ height: '1px', backgroundColor: '#ccc', width: '100%' }} />}
                </>
            )}

            {Object.entries(props.tabs).map(([key, tab]) => (
                <ActivityProvider mode={key === props.selectedTab ? 'visible' : 'hidden'} key={key}>
                    {tab.body}
                </ActivityProvider>
            ))}

            {props.placement !== 'upper' && (
                <>
                    {props.divider && <div style={{ height: '1px', backgroundColor: '#ccc', width: '100%' }} />}
                    <Tabs style={props.style}>
                        {Object.entries(props.tabs).map(([key, tab]) => (
                            <Tab
                                style={props.tabStyle}
                                key={key}
                                onClick={() => props.setSelectedTab(key)}
                                selected={key === props.selectedTab}
                            >
                                {tab.tab}
                            </Tab>
                        ))}
                    </Tabs>
                </>
            )}
        </div>
    )
}
