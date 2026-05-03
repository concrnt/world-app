import { startTransition, Suspense, useEffect, useState } from 'react'
import { ScrollViewProps, ScrollViewRef } from '../types/ScrollView'

import { useClient } from '../contexts/Client'
import { useDrawer } from '../contexts/Drawer'

import { Header } from '../ui/Header'
import { FAB } from '../ui/FAB'
import { View, Tabs, Tab, Text } from '@concrnt/ui'

import { ListSettings } from '../components/ListSettings'
import { RealtimeTimeline } from '../components/RealtimeTimeline'

import { MdTune } from 'react-icons/md'
import { MdCreate } from 'react-icons/md'
import { useComposer } from '../contexts/Composer'
import { PinnedListItemClass, semantics, List } from '@concrnt/worldlib'
import { hapticLight } from '../utils/haptics'
import { CssVar } from '../types/Theme'
import { ListName } from '../components/ListName'
import { ProfileEditor } from '../components/ProfileEditor'
import { useSubscribe } from '../hooks/useSubscribe'

export const HomeView = (props: ScrollViewProps) => {
    const { client } = useClient()
    const drawer = useDrawer()

    const [selectedTabUri, setSelectedTabUri] = useState<string>(semantics.homeList(client.ccid, client.currentProfile))

    useEffect(() => {
        setSelectedTabUri(semantics.homeList(client.ccid, client.currentProfile))
    }, [client])

    // fix default settings
    useEffect(() => {
        if (!client) return
        if (!(client.currentProfile in client.profiles)) {
            drawer.open(
                <ProfileEditor
                    noLoading
                    title="プロフィールを設定しましょう！"
                    targetURI={semantics.profile(client.ccid, client.currentProfile ?? 'main')}
                    onComplete={() => drawer.close()}
                />
            )
        }
    }, [client, drawer])

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
                <Suspense>
                    <HomeMain ref={props.ref} selectedTabUri={selectedTabUri} setSelectedTabUri={setSelectedTabUri} />
                </Suspense>
            </View>
        </>
    )
}

const HomeMain = ({
    ref,
    selectedTabUri,
    setSelectedTabUri
}: {
    ref?: ScrollViewRef
    selectedTabUri: string
    setSelectedTabUri: (uri: string) => void
}) => {
    const { client } = useClient()

    const [pinnedLists] = useSubscribe(client.pinnedLists)

    const pin = pinnedLists.find((pin) => pin.uri === selectedTabUri)

    return (
        <>
            {pinnedLists.length > 1 && (
                <Tabs
                    style={{
                        color: CssVar.contentLink
                    }}
                >
                    {pinnedLists.map((tab) => (
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
            {pin && <TimelineWrap ref={ref} pin={pin} />}
        </>
    )
}

const TimelineWrap = (props: { pin: PinnedListItemClass; ref?: ScrollViewRef }) => {
    const [list] = useSubscribe(props.pin.list)

    if (!list) return <Text>リストが見つかりませんでした</Text>

    return (
        <>
            <Timeline ref={props.ref} list={list} />
            <InnerFab defaultPostTimelines={props.pin.defaultPostTimelines} />
        </>
    )
}

const Timeline = (props: { list: List; ref?: ScrollViewRef }) => {
    const { client } = useClient()

    const [items] = useSubscribe(props.list.items)

    const self = semantics.homeTimeline(client.ccid, client.currentProfile)
    const timelines = [...new Set([self, ...items])]

    return <RealtimeTimeline ref={props.ref} timelines={timelines} />
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
