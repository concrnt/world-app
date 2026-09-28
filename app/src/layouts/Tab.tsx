import { CSSProperties, ReactNode, useEffect, useId, useState } from 'react'
import { Tabs, Tab } from '@concrnt/ui'
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
}

export const TabLayout = (props: Props) => {
    const tabId = useId()

    // 起動時は選択中のタブだけ中身をマウントし、残りは少し遅らせて温める。
    // 非表示タブ(Explorer/Contacts等)はActivity hidden中でもrender-phaseのフェッチを発行し、
    // ホームの先頭取得と同一オリジンの接続を取り合うため。ActivityProvider自体は全タブ分マウントしたまま
    // (Notificationsはバッジ消去にuseActivity()を使う)。requestIdleCallbackは起動直後でも
    // すぐ発火してしまうので固定の猶予にする
    const [mountedTabs, setMountedTabs] = useState<Set<string>>(() => new Set([props.selectedTab]))
    useEffect(() => {
        setMountedTabs((prev) => {
            if (prev.has(props.selectedTab)) return prev
            return new Set([...prev, props.selectedTab])
        })
    }, [props.selectedTab])
    useEffect(() => {
        const timer = setTimeout(() => setMountedTabs(new Set(Object.keys(props.tabs))), 2000)
        return () => clearTimeout(timer)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

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
                </>
            )}

            {Object.entries(props.tabs).map(([key, tab]) => (
                <ActivityProvider mode={key === props.selectedTab ? 'visible' : 'hidden'} key={key}>
                    {mountedTabs.has(key) ? tab.body : null}
                </ActivityProvider>
            ))}

            {props.placement !== 'upper' && (
                <>
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
