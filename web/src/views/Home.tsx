import { ReactNode, startTransition, Suspense, useEffect, useImperativeHandle, useRef, useState } from 'react'
import { ScrollViewHandle, ScrollViewProps, ScrollViewRef } from '../types/ScrollView'

import { useClient } from '../contexts/Client'
import { useDrawer } from '../contexts/Drawer'

import { Tabs, Tab, Text, Divider } from '@concrnt/ui'
import { Header } from '../components/Header'
import { View } from '../components/View'

import { ListSettings } from '../components/ListSettings'
import { RealtimeTimeline } from '../components/RealtimeTimeline'

import { MdTune } from 'react-icons/md'
import { PinnedListItemClass, semantics, List } from '@concrnt/worldlib'
import { CssVar } from '../types/Theme'
import { ListName } from '../components/ListName'
import { ProfileEditor } from '../components/ProfileEditor'
import { useSubscribe } from '../hooks/useSubscribe'
import { usePreference } from '../contexts/Preference'
import { sortByListOrder } from '../utils/listOrder'
import { Composer } from '../components/Composer'

export const HomeView = (props: ScrollViewProps) => {
    const { client } = useClient()
    const drawer = useDrawer()

    const scrollRef = useRef<ScrollViewHandle>(null)
    useImperativeHandle(props.ref, () => ({
        scrollToTop: () => scrollRef.current?.scrollToTop()
    }))

    const [selectedTabUri, setSelectedTabUri] = useState<string>('')

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
    const { client } = useClient()
    const [list] = useSubscribe(props.pin.list)
    const [knownCommunities] = useSubscribe(client.knownCommunities)

    if (!list) return <Text>リストが見つかりませんでした</Text>

    return (
        <Timeline
            ref={props.ref}
            list={list}
            headElement={
                <>
                    <div style={{ padding: CssVar.space(2) }}>
                        <Composer
                            mode="normal"
                            destinations={props.pin.defaultPostTimelines}
                            options={knownCommunities}
                            initialProfile={props.pin.defaultProfile}
                        />
                    </div>
                    <Divider />
                </>
            }
        />
    )
}

const Timeline = (props: { list: List; ref?: ScrollViewRef; headElement?: ReactNode }) => {
    const { client } = useClient()

    const [items] = useSubscribe(props.list.items)

    const self = semantics.homeTimeline(client.ccid, client.currentProfile)
    const timelines = [...new Set([self, ...items])]

    return <RealtimeTimeline ref={props.ref} timelines={timelines} headElement={props.headElement} />
}
