import { startTransition, Suspense, use, useEffect, useMemo, useState } from 'react'
import { ScrollViewProps } from '../types/ScrollView'

import { useClient } from '../contexts/Client'
import { useDrawer } from '../contexts/Drawer'

import { Header } from '../ui/Header'
import { View, Tabs, Tab } from '@concrnt/ui'
import { FAB } from '../ui/FAB'

import { ListSettings } from '../components/ListSettings'
import { RealtimeTimeline } from '../components/RealtimeTimeline'

import { MdTune } from 'react-icons/md'
import { MdCreate } from 'react-icons/md'
import { useComposer } from '../contexts/Composer'
import { PinnedListItem, semantics } from '@concrnt/worldlib'
import { hapticLight } from '../utils/haptics'
import { CssVar } from '../types/Theme'
import { ListName } from '../components/ListName'
import { ProfileEditor } from '../components/ProfileEditor'

export const HomeView = (props: ScrollViewProps) => {
    const { client } = useClient()

    const drawer = useDrawer()

    const pinnedLists = client?.pinnedLists ?? []

    const tabs = useMemo(
        () =>
            pinnedLists.map((pin) => ({
                uri: pin.uri,
                pinData: pin
            })),
        [pinnedLists]
    )

    const [selectedTabUri, setSelectedTabUri] = useState<string>(
        semantics.homeList(client?.ccid ?? '', client?.currentProfile ?? 'main')
    )
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
                        if (!items.includes(semantics.homeTimeline(client.ccid, client?.currentProfile))) {
                            items.unshift(semantics.homeTimeline(client.ccid, client?.currentProfile))
                        }
                        return items
                    })
                    .catch((e) => {
                        console.error(e)
                        return [semantics.homeTimeline(client.ccid, client?.currentProfile)]
                    }) ?? Promise.resolve([semantics.homeTimeline(client.ccid, client?.currentProfile)])
            )
        } else {
            return Promise.resolve([semantics.homeTimeline(client.ccid, client?.currentProfile)])
        }
    }, [selectedTabUri, tabs, client])

    // fix default settings
    useEffect(() => {
        if (!client) return
        if (!(client.currentProfile in client.profiles)) {
            drawer.open(
                <ProfileEditor
                    title="プロフィールを設定しましょう！"
                    targetURI={semantics.profile(client.ccid, client.currentProfile ?? 'main')}
                    onComplete={() => drawer.close()}
                />
            )
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
                <Suspense key={selectedTabUri} fallback={<></>}>
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
    pinnedLists: PinnedListItem[]
    selectedTabUri: string
    setSelectedTabUri: (uri: string) => void
    tabs: {
        uri: string
        pinData: PinnedListItem
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
