import { ReactNode, startTransition, Suspense, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { ScrollViewHandle, ScrollViewProps, ScrollViewRef } from '../types/ScrollView'

import { useClient } from '../contexts/Client'
import { Drawer } from '../components/Drawer'

import { Tabs, Tab, Text, Divider, Button } from '@concrnt/ui'
import { ErrorBoundary } from 'react-error-boundary'
import { useTranslation } from 'react-i18next'
import { Header } from '../components/Header'
import { View } from '../components/View'

import { ListSettings } from '../components/ListSettings'
import { RealtimeTimeline } from '../components/RealtimeTimeline'
import { MessageSkeleton } from '../components/message/MessageSkeleton'

import { MdTune } from 'react-icons/md'
import { PinnedListItemClass, semantics, List } from '@concrnt/worldlib'
import { CssVar } from '../types/Theme'
import { ListName } from '../components/ListName'
import { ProfileEditor } from '../components/ProfileEditor'
import { useSubscribe } from '../hooks/useSubscribe'
import { usePreference } from '../contexts/Preference'
import { sortByListOrder } from '../utils/listOrder'
import { Composer } from '../components/Composer'
import { ComposeFAB } from '../components/ComposeFAB'
import { PostContextProvider } from '../contexts/PostContext'
import { useIsMobile } from '../hooks/useIsMobile'

export const HomeView = (props: ScrollViewProps) => {
    const { t } = useTranslation('', { keyPrefix: 'views.home' })
    const { client, isDomainOffline } = useClient()

    const scrollRef = useRef<ScrollViewHandle>(null)
    useImperativeHandle(props.ref, () => ({
        scrollToTop: () => scrollRef.current?.scrollToTop()
    }))

    const location = useLocation()
    const navigate = useNavigate()
    let hashTabUri = ''
    try {
        hashTabUri = location.hash ? decodeURIComponent(location.hash.slice(1)) : ''
    } catch (e) {
        console.warn('HomeView decodeURIComponent error', e)
    }
    const selectTab = (uri: string) => {
        if (uri === hashTabUri) return
        navigate({ hash: encodeURIComponent(uri) })
    }
    const [listSettingsOpen, setListSettingsOpen] = useState(false)

    // fix default settings
    // 一度閉じたらeffect再実行(言語ロード等)で再表示しないためのガード
    const profileSetupOpened = useRef(false)
    const [profileSetupOpen, setProfileSetupOpen] = useState(false)
    useEffect(() => {
        if (!client) return
        // オフライン時はプロフィールがキャッシュから読めなかっただけの可能性があり、
        // そもそもcommitもできないので表示しない
        if (isDomainOffline) return
        if (profileSetupOpened.current) return
        if (!(client.currentProfile in client.profiles)) {
            profileSetupOpened.current = true
            setProfileSetupOpen(true)
        }
    }, [client, isDomainOffline])

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
                            onClick={() => setListSettingsOpen(true)}
                        >
                            <MdTune size={24} />
                        </div>
                    }
                >
                    Home
                </Header>
                <Drawer open={profileSetupOpen} onClose={() => setProfileSetupOpen(false)}>
                    <ProfileEditor
                        noLoading
                        title={t('setUpProfile')}
                        targetURI={semantics.profile(client.ccid, client.currentProfile ?? 'main')}
                        onComplete={() => setProfileSetupOpen(false)}
                    />
                </Drawer>
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
                            hashTabUri={hashTabUri}
                            selectTab={selectTab}
                            listSettingsOpen={listSettingsOpen}
                            closeListSettings={() => setListSettingsOpen(false)}
                        />
                    </Suspense>
                </ErrorBoundary>
            </View>
        </>
    )
}

const HomeMain = ({
    ref,
    hashTabUri,
    selectTab,
    listSettingsOpen,
    closeListSettings
}: {
    ref?: ScrollViewRef
    hashTabUri: string
    selectTab: (uri: string) => void
    listSettingsOpen: boolean
    closeListSettings: () => void
}) => {
    const { client } = useClient()

    const [pinnedLists] = useSubscribe(client.pinnedLists)
    const [listOrder] = usePreference('listOrder')

    const order = listOrder?.[client.currentProfile] ?? []
    const sortedPins = sortByListOrder(pinnedLists, order)

    // ハッシュ無し・ピン解除済み等で該当しないときは先頭のピンにフォールバックする
    const effectiveTabUri = sortedPins.some((pin) => pin.uri === hashTabUri) ? hashTabUri : (sortedPins[0]?.uri ?? '')
    const pin = sortedPins.find((pin) => pin.uri === effectiveTabUri)

    return (
        <>
            <Drawer open={listSettingsOpen} onClose={closeListSettings}>
                <ListSettings uri={effectiveTabUri} onComplete={closeListSettings} />
            </Drawer>
            {sortedPins.length > 1 && (
                <Tabs
                    style={{
                        color: CssVar.contentLink,
                        justifyContent: 'flex-start'
                    }}
                >
                    {sortedPins.map((tab) => (
                        <Tab
                            key={tab.uri}
                            selected={effectiveTabUri === tab.uri}
                            onClick={() =>
                                startTransition(() => {
                                    selectTab(tab.uri)
                                })
                            }
                            groupId="home-timeline-tabs"
                            style={{
                                color: CssVar.contentText,
                                flex: '0 0 auto',
                                width: 'auto',
                                minWidth: '90px',
                                maxWidth: '360px'
                            }}
                        >
                            <ListName pin={tab} />
                        </Tab>
                    ))}
                </Tabs>
            )}
            {pin && (
                <Suspense key={pin.uri} fallback={<MessageSkeleton />}>
                    <PostContextProvider destinations={pin.defaultPostTimelines} profile={pin.defaultProfile}>
                        <TimelineWrap ref={ref} pin={pin} />
                    </PostContextProvider>
                </Suspense>
            )}
        </>
    )
}

const TimelineWrap = (props: { pin: PinnedListItemClass; ref?: ScrollViewRef }) => {
    const { t } = useTranslation('', { keyPrefix: 'views.home' })
    const { client } = useClient()
    const [list] = useSubscribe(props.pin.list)
    const [knownCommunities] = useSubscribe(client.knownCommunities)
    const isMobile = useIsMobile()

    // インラインエディタの投稿先。リストのデフォルトを初期値にしつつ、その場で編集できるようにする
    const [destinations, setDestinations] = useState<string[]>(props.pin.defaultPostTimelines)
    // タブでリストを切り替えたらそのリストのデフォルト投稿先に戻す
    const [prevPinUri, setPrevPinUri] = useState(props.pin.uri)
    if (prevPinUri !== props.pin.uri) {
        setPrevPinUri(props.pin.uri)
        setDestinations(props.pin.defaultPostTimelines)
    }

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
                                    destinations={destinations}
                                    setDestinations={setDestinations}
                                    defaultDestinations={props.pin.defaultPostTimelines}
                                    options={knownCommunities}
                                    initialProfile={props.pin.defaultProfile}
                                />
                            </div>
                            <Divider />
                        </>
                    )
                }
            />
            <ComposeFAB />
        </>
    )
}

const Timeline = (props: { list: List; excludeSelf?: boolean; ref?: ScrollViewRef; headElement?: ReactNode }) => {
    const { client } = useClient()

    const [items] = useSubscribe(props.list.items)

    const self = semantics.homeTimeline(client.ccid, client.currentProfile)
    const timelines = useMemo(
        () => [...new Set([...(props.excludeSelf ? [] : [self]), ...items])],
        [self, items, props.excludeSelf]
    )

    return <RealtimeTimeline ref={props.ref} timelines={timelines} headElement={props.headElement} />
}
