import { useEffect, useMemo, useState } from 'react'
import { ScrollViewProps } from '../types/ScrollView'

import { useClient } from '../contexts/Client'
import { useTheme } from '../contexts/Theme'
import { useDrawer } from '../contexts/Drawer'
import { usePreference } from '../contexts/Preference'

import { Header } from '../ui/Header'
import { View } from '../ui/View'
import { Tabs } from '../ui/Tabs'
import { Tab } from '../ui/Tab'
import { Text } from '../ui/Text'
import { FAB } from '../ui/FAB'

import { ListSettings } from '../components/ListSettings'
import { RealtimeTimeline } from '../components/RealtimeTimeline'

import { MdTune } from 'react-icons/md'
import { MdCreate } from 'react-icons/md'
import { useComposer } from '../contexts/Composer'
import { isFulfilled, isNonNull } from '@concrnt/worldlib'

export const HomeView = (props: ScrollViewProps) => {
    const { client } = useClient()
    const theme = useTheme()

    const composer = useComposer()

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

    const [timelineIDs, setTimelineIDs] = useState<string[]>([])
    const [timeliens, setTimelines] = useState<any[]>([])
    useEffect(() => {
        setTimelineIDs([])
        setTimelines([])
        const selectedTab = tabs.find((tab) => tab.uri === selectedTabUri)
        if (selectedTab) {
            client?.getList(selectedTab.uri).then((list) => {
                setTimelineIDs(list?.items ?? [])
                Promise.allSettled((list?.items ?? []).map((uri) => client.getTimeline(uri))).then((results) => {
                    setTimelines(
                        results
                            .filter(isFulfilled)
                            .map((res) => res.value)
                            .filter(isNonNull)
                    )
                })
            })
        } else {
            setTimelineIDs([])
            setTimelines([])
        }
    }, [selectedTabUri, tabs, client])

    // fix default settings
    useEffect(() => {
        if (!client) return
        const homeURI = `cckv://${client.ccid}/concrnt.world/main/home-list`
        if (!pinnedLists.find((pin) => pin.uri === homeURI)) {
            setPinnedLists([{ uri: homeURI, defaultPostHome: true, defaultPostTimelines: [] }, ...pinnedLists])
        }
    }, [client, pinnedLists, setPinnedLists])

    return (
        <>
            <View>
                <Header
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
                <RealtimeTimeline ref={props.ref} timelines={timelineIDs} />
            </View>
            <FAB
                onClick={() => {
                    composer.open(
                        pinnedLists.find((pin) => pin.uri === selectedTabUri)?.defaultPostTimelines ?? [],
                        timeliens
                    )
                }}
            >
                <MdCreate size={24} />
            </FAB>
        </>
    )
}
