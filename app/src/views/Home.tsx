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
import { isFulfilled, Schemas } from '@concrnt/worldlib'
import { CssVar } from '../types/Theme'

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

    const [selectedTabUri, setSelectedTabUri] = useState<string>(`cckv://${client?.ccid}/concrnt.world/main/home-list`)
    const selectedTab = tabs.find((tab) => tab.uri === selectedTabUri)

    const timelineIDsPromise = useMemo(() => {
        if (selectedTab) {
            return (
                client
                    ?.getList(selectedTab.uri)
                    .then((list) => {
                        const items = list?.items ?? []
                        if (!items.includes(`cckv://${client?.ccid}/concrnt.world/main/home-timeline`)) {
                            items.unshift(`cckv://${client?.ccid}/concrnt.world/main/home-timeline`)
                        }
                        return items
                    })
                    .catch((e) => {
                        console.error(e)
                        return [`cckv://${client?.ccid}/concrnt.world/main/home-timeline`]
                    }) ?? Promise.resolve([`cckv://${client?.ccid}/concrnt.world/main/home-timeline`])
            )
        } else {
            return Promise.resolve([`cckv://${client?.ccid}/concrnt.world/main/home-timeline`])
        }
    }, [selectedTabUri, tabs, client])

    const communitiesPromise = useMemo(() => {
        return timelineIDsPromise.then((timelineIDs) => {
            return Promise.allSettled(timelineIDs.map((uri) => client?.getTimeline(uri))).then((results) => {
                return results
                    .filter(isFulfilled)
                    .map((res) => res.value)
                    .filter((timeline) => !!timeline)
                    .filter((tl) => tl.schema === Schemas.communityTimeline)
            })
        })
    }, [timelineIDsPromise, client])

    // fix default settings
    useEffect(() => {
        if (!client) return
        const homeURI = `cckv://${client.ccid}/concrnt.world/main/home-list`
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
                                <Text>{client?.getList(tab.uri).then((l) => l?.title)}</Text>
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
            <Suspense fallback={<div />}>
                <InnerFab
                    defaultPostTimelines={selectedTab?.pinData.defaultPostTimelines ?? []}
                    communitiesPromise={communitiesPromise}
                />
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

const InnerFab = (props: { defaultPostTimelines: string[]; communitiesPromise: Promise<any[]> }) => {
    const composer = useComposer()
    const communities = use(props.communitiesPromise)
    console.log('communities', communities)

    return (
        <FAB
            onClick={() => {
                composer.open(props.defaultPostTimelines, communities)
            }}
        >
            <MdCreate size={24} />
        </FAB>
    )
}
