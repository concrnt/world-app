import { startTransition, Suspense, useEffect, useImperativeHandle, useRef, useState } from 'react'
import { ScrollViewHandle, ScrollViewProps, ScrollViewRef } from '../types/ScrollView'

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
import { usePreference } from '../contexts/Preference'
import { sortByListOrder } from '../utils/listOrder'

export const HomeView = (props: ScrollViewProps) => {
    const { client, offlineDomain } = useClient()
    const drawer = useDrawer()

    const scrollRef = useRef<ScrollViewHandle>(null)
    useImperativeHandle(props.ref, () => ({
        scrollToTop: () => scrollRef.current?.scrollToTop()
    }))

    const [selectedTabUri, setSelectedTabUri] = useState<string>('')

    // fix default settings
    useEffect(() => {
        if (!client) return
        if (offlineDomain) return
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
    }, [client, drawer, offlineDomain])

    if (offlineDomain) {
        return (
            <View>
                <Header onTitleTap={() => scrollRef.current?.scrollToTop()}>Home</Header>
                <div
                    style={{
                        padding: CssVar.space(4),
                        display: 'flex',
                        flexDirection: 'column',
                        gap: CssVar.space(1)
                    }}
                >
                    <Text variant="h3">ホームを読み込めません</Text>
                    <Text style={{ opacity: 0.7 }}>
                        自分のドメインがオフラインのため、ホームタイムラインや投稿先リストを取得できません。
                    </Text>
                </div>
            </View>
        )
    }

    return (
        <>
            <View>
                <Header
                    onTitleTap={() => scrollRef.current?.scrollToTop()}
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
                    <HomeMain ref={scrollRef} selectedTabUri={selectedTabUri} setSelectedTabUri={setSelectedTabUri} />
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
    const [listOrder] = usePreference('listOrder')

    const order = listOrder?.[client.currentProfile] ?? []
    const sortedPins = sortByListOrder(pinnedLists, order)

    const pin = sortedPins.find((pin) => pin.uri === selectedTabUri)

    useEffect(() => {
        if (selectedTabUri === '' && sortedPins.length > 0) {
            setSelectedTabUri(sortedPins[0].uri)
        }
    }, [selectedTabUri])

    return (
        <>
            {sortedPins.length > 1 && (
                <Tabs
                    style={{
                        color: CssVar.contentLink
                    }}
                >
                    {sortedPins.map((tab) => (
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
