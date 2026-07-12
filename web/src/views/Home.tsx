import { ReactNode, startTransition, Suspense, useEffect, useImperativeHandle, useRef, useState } from 'react'
import { ScrollViewHandle, ScrollViewProps, ScrollViewRef } from '../types/ScrollView'

import { useClient } from '../contexts/Client'
import { useDrawer } from '../contexts/Drawer'

import { Tabs, Tab, Text, Divider, Button } from '@concrnt/ui'
import { ErrorBoundary } from 'react-error-boundary'
import { useTranslation } from 'react-i18next'
import { Header } from '../components/Header'
import { View } from '../components/View'

import { ListSettings } from '../components/ListSettings'
import { RealtimeTimeline } from '../components/RealtimeTimeline'

import { MdTune } from 'react-icons/md'
import { MdCreate } from 'react-icons/md'
import { PinnedListItemClass, semantics, List } from '@concrnt/worldlib'
import { hapticLight } from '../utils/haptics'
import { CssVar } from '../types/Theme'
import { ListName } from '../components/ListName'
import { ProfileEditor } from '../components/ProfileEditor'
import { useSubscribe } from '../hooks/useSubscribe'
import { usePreference } from '../contexts/Preference'
import { sortByListOrder } from '../utils/listOrder'
import { Composer } from '../components/Composer'
import { FAB } from '../components/FAB'
import { useComposer } from '../contexts/Composer'
import { useIsMobile } from '../hooks/useIsMobile'

export const HomeView = (props: ScrollViewProps) => {
    const { t } = useTranslation('', { keyPrefix: 'views.home' })
    const { client, isDomainOffline } = useClient()
    const drawer = useDrawer()

    const scrollRef = useRef<ScrollViewHandle>(null)
    useImperativeHandle(props.ref, () => ({
        scrollToTop: () => scrollRef.current?.scrollToTop()
    }))

    const [selectedTabUri, setSelectedTabUri] = useState<string>('')

    // fix default settings
    useEffect(() => {
        if (!client) return
        // オフライン時はプロフィールがキャッシュから読めなかっただけの可能性があり、
        // そもそもcommitもできないので表示しない
        if (isDomainOffline) return
        if (!(client.currentProfile in client.profiles)) {
            drawer.open(
                <ProfileEditor
                    noLoading
                    title={t('setUpProfile')}
                    targetURI={semantics.profile(client.ccid, client.currentProfile ?? 'main')}
                    onComplete={() => drawer.close()}
                />
            )
        }
    }, [client, drawer, isDomainOffline, t])

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
                <ErrorBoundary
                    fallbackRender={({ resetErrorBoundary }) => (
                        <div
                            style={{
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                gap: CssVar.space(2),
                                padding: CssVar.space(4)
                            }}
                        >
                            <Text variant="caption">{t('loadFailed')}</Text>
                            <Button onClick={() => resetErrorBoundary()}>{t('retry')}</Button>
                        </div>
                    )}
                >
                    <Suspense>
                        <HomeMain
                            ref={scrollRef}
                            selectedTabUri={selectedTabUri}
                            setSelectedTabUri={setSelectedTabUri}
                        />
                    </Suspense>
                </ErrorBoundary>
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
                        color: CssVar.contentLink,
                        overflowX: 'auto',
                        justifyContent: 'flex-start'
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
                                width: '120px',
                                flexShrink: 0
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
    const { t } = useTranslation('', { keyPrefix: 'views.home' })
    const { client } = useClient()
    const [list] = useSubscribe(props.pin.list)
    const [knownCommunities] = useSubscribe(client.knownCommunities)
    const isMobile = useIsMobile()

    if (!list) return <Text>{t('listNotFound')}</Text>

    return (
        <>
            <Timeline
                ref={props.ref}
                list={list}
                excludeSelf={props.pin.excludeSelf}
                headElement={
                    // モバイルではインラインエディタは出さず、FABからモーダルで投稿する(app版と同じ体験)
                    isMobile ? undefined : (
                        <>
                            <div style={{ padding: CssVar.space(2) }}>
                                <Composer
                                    mode="normal"
                                    autoGrow
                                    destinations={props.pin.defaultPostTimelines}
                                    options={knownCommunities}
                                    initialProfile={props.pin.defaultProfile}
                                />
                            </div>
                            <Divider />
                        </>
                    )
                }
            />
            <InnerFab defaultPostTimelines={props.pin.defaultPostTimelines} defaultProfile={props.pin.defaultProfile} />
        </>
    )
}

const InnerFab = (props: { defaultPostTimelines: string[]; defaultProfile?: string }) => {
    const composer = useComposer()

    return (
        <FAB
            onClick={() => {
                hapticLight()
                composer.open(props.defaultPostTimelines, undefined, undefined, undefined, props.defaultProfile)
            }}
        >
            <MdCreate size={24} />
        </FAB>
    )
}

const Timeline = (props: { list: List; excludeSelf?: boolean; ref?: ScrollViewRef; headElement?: ReactNode }) => {
    const { client } = useClient()

    const [items] = useSubscribe(props.list.items)

    const self = semantics.homeTimeline(client.ccid, client.currentProfile)
    const timelines = [...new Set([...(props.excludeSelf ? [] : [self]), ...items])]

    return <RealtimeTimeline ref={props.ref} timelines={timelines} headElement={props.headElement} />
}
