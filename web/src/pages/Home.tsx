import { Suspense, useEffect, useState } from 'react'
import { CssVar, Tab, Tabs, Text, View } from '@concrnt/ui'
import { semantics, type List, type PinnedListItemClass } from '@concrnt/worldlib'
import { RealtimeTimeline } from '../components/RealtimeTimeline'
import { useComposerLauncher } from '../contexts/Composer'
import { useClient } from '../contexts/Client'
import { useSubscribe } from '../hooks/useSubscribe'
import { Header } from '../ui/Header'

export const Home = () => {
    const { client } = useClient()
    const homeListUri = semantics.homeList(client!.ccid, client!.currentProfile)
    const [manualSelectedTabUri, setManualSelectedTabUri] = useState<string | null>(null)
    const selectedTabUri = manualSelectedTabUri ?? homeListUri

    if (!client) return null

    return (
        <View
            style={{
                margin: 0,
                height: '100%',
                minHeight: 0
            }}
        >
            <Header>Home</Header>
            <Suspense fallback={<PageStatus label="ホームを読み込んでいます..." />}>
                <HomeBody selectedTabUri={selectedTabUri} setSelectedTabUri={setManualSelectedTabUri} />
            </Suspense>
        </View>
    )
}

const HomeBody = (props: { selectedTabUri: string; setSelectedTabUri: (uri: string) => void }) => {
    const { client } = useClient()
    const composer = useComposerLauncher()
    const [pinnedLists] = useSubscribe(client!.pinnedLists)
    const selectedPin = pinnedLists.find((pin) => pin.uri === props.selectedTabUri) ?? pinnedLists[0]

    useEffect(() => {
        if (selectedPin && selectedPin.uri !== props.selectedTabUri) {
            props.setSelectedTabUri(selectedPin.uri)
        }
    }, [props, selectedPin])

    useEffect(() => {
        composer.setAdditionalDestinations(selectedPin?.defaultPostTimelines ?? [])

        return () => {
            composer.setAdditionalDestinations([])
        }
    }, [composer, selectedPin])

    return (
        <>
            {pinnedLists.length > 1 && (
                <Tabs
                    style={{
                        padding: CssVar.space(2),
                        borderBottom: `1px solid ${CssVar.divider}`
                    }}
                >
                    {pinnedLists.map((pin) => (
                        <Tab
                            key={pin.uri}
                            selected={(selectedPin ?? pin).uri === pin.uri}
                            groupId="web-home-tabs"
                            style={{
                                color: CssVar.contentText
                            }}
                            onClick={() => props.setSelectedTabUri(pin.uri)}
                        >
                            <HomeTabLabel pin={pin} />
                        </Tab>
                    ))}
                </Tabs>
            )}

            <div
                style={{
                    display: 'flex',
                    flexDirection: 'column',
                    minHeight: 0,
                    flex: 1
                }}
            >
                <HomeTimeline selectedPin={selectedPin} />
            </div>
        </>
    )
}

const HomeTabLabel = (props: { pin: PinnedListItemClass }) => {
    const [list] = useSubscribe(props.pin.list)

    return <>{list?.title ?? 'Untitled List'}</>
}

const HomeTimeline = (props: { selectedPin?: PinnedListItemClass }) => {
    const { client } = useClient()

    if (!client) return null

    if (!props.selectedPin) {
        return <RealtimeTimeline timelines={[semantics.homeTimeline(client.ccid, client.currentProfile)]} />
    }

    return <PinnedHomeTimeline pin={props.selectedPin} />
}

const PinnedHomeTimeline = (props: { pin: PinnedListItemClass }) => {
    const { client } = useClient()
    const [list] = useSubscribe(props.pin.list)

    if (!client) {
        return null
    }

    if (!list) {
        return <RealtimeTimeline timelines={[semantics.homeTimeline(client.ccid, client.currentProfile)]} />
    }

    return <PinnedHomeListItems list={list} homeTimeline={semantics.homeTimeline(client.ccid, client.currentProfile)} />
}

const PinnedHomeListItems = (props: { list: List; homeTimeline: string }) => {
    const [items] = useSubscribe(props.list.items)

    return <RealtimeTimeline timelines={[...new Set([props.homeTimeline, ...items])]} />
}

const PageStatus = (props: { label: string }) => {
    return (
        <div
            style={{
                flex: 1,
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                padding: CssVar.space(5)
            }}
        >
            <Text>{props.label}</Text>
        </div>
    )
}
