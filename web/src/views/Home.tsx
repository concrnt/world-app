import { startTransition, Suspense, useEffect, useState } from 'react'
import { ScrollViewProps, ScrollViewRef } from '../types/ScrollView'

import { useClient } from '../contexts/Client'
import { useDrawer } from '../contexts/Drawer'

import { Header } from '../ui/Header'
import { Tabs, Tab, Text, Button } from '@concrnt/ui'

import { ListSettings } from '../components/ListSettings'
import { RealtimeTimeline } from '../components/RealtimeTimeline'

import { MdTune } from 'react-icons/md'
import { PinnedListItemClass, semantics, List, Schemas } from '@concrnt/worldlib'
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
            <div>
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
            </div>
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
            <InlineComposer defaultPostTimelines={props.pin.defaultPostTimelines} />
            <Timeline ref={props.ref} list={list} />
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

const InlineComposer = (props: { defaultPostTimelines: string[] }) => {
    const { client } = useClient()
    const [draft, setDraft] = useState('')
    const [posting, setPosting] = useState(false)

    const handleSubmit = async () => {
        if (!draft.trim()) return

        setPosting(true)
        try {
            const key = Date.now().toString()
            const homeTimeline = semantics.homeTimeline(client.ccid, client.currentProfile)
            const distributes = [...new Set([homeTimeline, ...props.defaultPostTimelines])]

            await client.api.commit({
                key: semantics.post(client.ccid, client.currentProfile, key),
                schema: Schemas.markdownMessage,
                value: {
                    body: draft
                },
                author: client.ccid,
                distributes,
                createdAt: new Date()
            })
            setDraft('')
        } finally {
            setPosting(false)
        }
    }

    return (
        <div
            style={{
                display: 'flex',
                flexDirection: 'column',
                gap: CssVar.space(1),
                padding: CssVar.space(2),
                borderBottom: `1px solid ${CssVar.divider}`,
                backgroundColor: CssVar.contentBackground
            }}
        >
            <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="今、なにしてる？"
                rows={3}
                style={{
                    width: '100%',
                    resize: 'vertical',
                    border: `1px solid ${CssVar.divider}`,
                    borderRadius: CssVar.round(1),
                    backgroundColor: CssVar.contentBackground,
                    color: CssVar.contentText,
                    padding: CssVar.space(1),
                    font: 'inherit'
                }}
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <Button disabled={!draft.trim() || posting} onClick={handleSubmit}>
                    {posting ? '送信中...' : '投稿'}
                </Button>
            </div>
        </div>
    )
}
