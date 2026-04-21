import { startTransition, Suspense, use, useEffect, useMemo, useState } from 'react'
import { ScrollViewProps } from '../types/ScrollView'

import { useClient } from '../contexts/Client'
import { useDrawer } from '../contexts/Drawer'
import { PinnedList, usePreference } from '../contexts/Preference'

import { Header } from '../ui/Header'
import { View, Tabs, Tab, Text } from '@concrnt/ui'
import { FAB } from '../ui/FAB'

import { ListSettings } from '../components/ListSettings'
import { RealtimeTimeline } from '../components/RealtimeTimeline'

import { MdTune } from 'react-icons/md'
import { MdCreate } from 'react-icons/md'
import { useComposer } from '../contexts/Composer'
import { semantics } from '@concrnt/worldlib'
import { hapticLight } from '../utils/haptics'
import { CssVar } from '../types/Theme'
import { ListName } from '../components/ListName'

export const HomeView = (props: ScrollViewProps) => {
    const { client } = useClient()

    const drawer = useDrawer()
    const [pinnedLists, setPinnedLists] = usePreference('pinnedLists')

    const tabs = useMemo(
        () =>
            pinnedLists.map((pin) => ({
                uri: pin.uri,
                pinData: pin
            })),
        [pinnedLists]
    )

    const [selectedTabUri, setSelectedTabUri] = useState<string>(semantics.homeList(client?.ccid ?? ''))
    const selectedTab = tabs.find((tab) => tab.uri === selectedTabUri)

    console.log('HomeView: rendering', { selectedTabUri, tabs, client })

    const timelineIDsPromise = useMemo(() => {
        console.log('HomeView: calculating timelineIDsPromise', { selectedTabUri, tabs, client })
        if (!client) {
            return Promise.resolve([])
        }
        if (selectedTab) {
            return (
                client
                    .getList(selectedTab.uri)
                    .then((list) => {
                        const items = list?.items ?? []
                        if (!items.includes(semantics.homeTimeline(client.ccid))) {
                            items.unshift(semantics.homeTimeline(client.ccid))
                        }
                        return items
                    })
                    .catch((e) => {
                        console.error(e)
                        return [semantics.homeTimeline(client.ccid)]
                    }) ?? Promise.resolve([semantics.homeTimeline(client.ccid)])
            )
        } else {
            return Promise.resolve([semantics.homeTimeline(client.ccid)])
        }
    }, [selectedTabUri, tabs, client])

    // fix default settings
    useEffect(() => {
        if (!client) return
        const homeURI = semantics.homeList(client.ccid)
        if (!pinnedLists.find((pin) => pin.uri === homeURI)) {
            setPinnedLists((old) => [{ uri: homeURI, defaultPostHome: true, defaultPostTimelines: [] }, ...old])
        }
    }, [client])

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
                            color: CssVar.contentLink
                        }}
                    >
                        {tabs.map((tab) => (
                            <Tab
                                key={tab.uri}
                                selected={selectedTabUri === tab.uri}
                                onClick={() =>
                                    startTransition(() => {
                                        setSelectedTabUri(tab.uri)
                                    })
                                }
                                groupId="home-timeline-tabs"
                                style={{
                                    color: CssVar.contentText,
                                    width: '120px'
                                }}
                            >
                                <ListName uri={tab.uri} />
                            </Tab>
                        ))}
                    </Tabs>
                )}
                <Suspense key={selectedTabUri} fallback={<Text>Loading: {selectedTabUri}</Text>}>
                    <InnerHomeView
                        {...props}
                        pinnedLists={pinnedLists}
                        selectedTabUri={selectedTabUri}
                        setSelectedTabUri={setSelectedTabUri}
                        tabs={tabs}
                        timelineIDsPromise={timelineIDsPromise}
                    />
                </Suspense>
            </View>
            <Suspense key={selectedTabUri} fallback={<div />}>
                <InnerFab defaultPostTimelines={selectedTab?.pinData.defaultPostTimelines ?? []} />
            </Suspense>
        </>
    )
}

interface InnerHomeViewProps extends ScrollViewProps {
    pinnedLists: PinnedList[]
    selectedTabUri: string
    setSelectedTabUri: (uri: string) => void
    tabs: {
        uri: string
        pinData: PinnedList
    }[]
    timelineIDsPromise: Promise<string[]>
}

const InnerHomeView = (props: InnerHomeViewProps) => {
    const timelineIDs = use(props.timelineIDsPromise)

    return <RealtimeTimeline ref={props.ref} timelines={timelineIDs} />
}

const InnerFab = (props: { defaultPostTimelines: string[] }) => {
    const composer = useComposer()

    return (
        <FAB
            onClick={() => {
                hapticLight()
                composer.open(props.defaultPostTimelines)
            }}
        >
            <MdCreate size={24} />
        </FAB>
    )
}
