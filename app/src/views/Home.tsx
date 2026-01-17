import { useEffect, useMemo, useState } from 'react'
import { useClient } from '../contexts/Client'
import { Header } from '../ui/Header'
import { useSidebar } from '../layouts/Sidebar'
import { View } from '../ui/View'
import { ScrollViewProps } from '../types/ScrollView'
import { RealtimeTimeline } from '../components/RealtimeTimeline'

import { MdMenu } from 'react-icons/md'
import { MdTune } from 'react-icons/md'
import { ListSettings } from '../components/ListSettings'
import { Tabs } from '../ui/Tabs'
import { usePreference } from '../contexts/Preference'
import { Tab } from '../ui/Tab'
import { Text } from '../ui/Text'
import { useTheme } from '../contexts/Theme'
import { useDrawer } from '../contexts/Drawer'

export const HomeView = (props: ScrollViewProps) => {
    const { client } = useClient()
    const theme = useTheme()

    const { open } = useSidebar()
    const [pinnedLists, setPinnedLists] = usePreference('pinnedLists')

    const [, setUnused] = useState(0)

    const drawer = useDrawer()

    const tabs = useMemo(
        () =>
            pinnedLists.map((pin) => ({
                uri: pin.uri,
                pinData: pin
            })),
        [pinnedLists]
    )

    const [selectedTabUri, setSelectedTabUri] = useState<string>(tabs[0]?.uri ?? '')

    const [timelines, setTimelines] = useState<string[]>([])
    useEffect(() => {
        setTimelines([])
        const selectedTab = tabs.find((tab) => tab.uri === selectedTabUri)
        if (selectedTab) {
            client?.getList(selectedTab.uri).then((list) => {
                setTimelines(list?.items ?? [])
            })
        } else {
            setTimelines([])
        }
    }, [selectedTabUri, tabs, client])

    // fix default settings
    useEffect(() => {
        if (!client) return
        const homeURI = `cc://${client.ccid}/concrnt.world/main/home-list`
        if (!pinnedLists.find((pin) => pin.uri === homeURI)) {
            setPinnedLists([{ uri: homeURI, defaultPostHome: true, defaultPostTimelines: [] }, ...pinnedLists])
        }
    }, [client, pinnedLists, setPinnedLists])

    return (
        <View>
            <Header
                left={
                    <div
                        style={{
                            width: '100%',
                            height: '100%',
                            display: 'flex',
                            justifyContent: 'center',
                            alignItems: 'center'
                        }}
                        onClick={() => open()}
                    >
                        <MdMenu size={24} />
                    </div>
                }
                right={
                    <div
                        style={{
                            width: '100%',
                            height: '100%',
                            display: 'flex',
                            justifyContent: 'center',
                            alignItems: 'center'
                        }}
                        onClick={() =>
                            drawer.open(
                                <ListSettings
                                    uri={selectedTabUri}
                                    onComplete={() => {
                                        drawer.close()
                                        setUnused((u) => u + 1)
                                    }}
                                />
                            )
                        }
                    >
                        <MdTune size={24} />
                    </div>
                }
            >
                Home
            </Header>
            {pinnedLists.length > 1 && (
                <Tabs
                    style={{
                        color: theme.content.link
                    }}
                >
                    {tabs.map((tab) => (
                        <Tab
                            key={tab.uri}
                            selected={selectedTabUri === tab.uri}
                            onClick={() => setSelectedTabUri(tab.uri)}
                            groupId="home-timeline-tabs"
                            style={{
                                color: theme.content.text,
                                width: '120px'
                            }}
                        >
                            <Text>{client?.getList(tab.uri).then((l) => l?.title)}</Text>
                        </Tab>
                    ))}
                </Tabs>
            )}
            <RealtimeTimeline ref={props.ref} timelines={timelines} />
        </View>
    )
}
