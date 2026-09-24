import { startTransition, Suspense, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react'
import { ScrollViewHandle, ScrollViewProps, ScrollViewRef } from '../types/ScrollView'

import { useClient } from '../contexts/Client'
import { Drawer } from '../ui/Drawer'

import { Header } from '../ui/Header'
import { View, Tabs, Tab, Text, Button } from '@concrnt/ui'
import { ErrorBoundary } from 'react-error-boundary'
import { useTranslation } from 'react-i18next'

import { ListSettings } from '../components/ListSettings'
import { RealtimeTimeline } from '../components/RealtimeTimeline'
import { ComposeFAB } from '../components/ComposeFAB'
import { TimelineSkeleton } from '../components/TimelineSkeleton'
import { PostContextProvider } from '../contexts/PostContext'

import { MdTune } from 'react-icons/md'
import { PinnedListItemClass, semantics, List } from '@concrnt/worldlib'
import { CssVar } from '../types/Theme'
import { ListName } from '../components/ListName'
import { ProfileEditor } from '../components/ProfileEditor'
import { useSubscribe } from '../hooks/useSubscribe'
import { usePreference } from '../contexts/Preference'
import { sortByListOrder } from '../utils/listOrder'

export const HomeView = (props: ScrollViewProps) => {
    const { t } = useTranslation('', { keyPrefix: 'views.home' })
    const { client, isDomainOffline } = useClient()

    const scrollRef = useRef<ScrollViewHandle>(null)
    useImperativeHandle(props.ref, () => ({
        scrollToTop: () => scrollRef.current?.scrollToTop(),
        reselect: () => scrollRef.current?.reselect?.()
    }))

    const [selectedTabUri, setSelectedTabUri] = useState<string>('')
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
                <Drawer open={listSettingsOpen} onClose={() => setListSettingsOpen(false)}>
                    <ListSettings uri={selectedTabUri} onComplete={() => setListSettingsOpen(false)} />
                </Drawer>
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

    // ピン解除済み等で該当しないときは先頭のピンにフォールバックする
    const effectiveTabUri = sortedPins.some((pin) => pin.uri === selectedTabUri)
        ? selectedTabUri
        : (sortedPins[0]?.uri ?? '')
    const pin = sortedPins.find((pin) => pin.uri === effectiveTabUri)

    // 下部タブのホーム再タップ: 先頭以外のリストを完全にトップで見ているときだけ先頭リストへ戻す。
    // それ以外(スクロール中/先頭リスト/ピン1つ)は従来どおりスクロールトップ
    const timelineRef = useRef<ScrollViewHandle>(null)
    useImperativeHandle(
        ref,
        () => ({
            scrollToTop: () => timelineRef.current?.scrollToTop(),
            reselect: () => {
                const first = sortedPins[0]
                if (first && first.uri !== effectiveTabUri && timelineRef.current?.isAtTop?.()) {
                    startTransition(() => {
                        setSelectedTabUri(first.uri)
                    })
                } else {
                    timelineRef.current?.scrollToTop()
                }
            }
        }),
        [sortedPins, effectiveTabUri, setSelectedTabUri]
    )

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
                        justifyContent: 'flex-start'
                    }}
                >
                    {sortedPins.map((tab) => (
                        <Tab
                            key={tab.uri}
                            selected={effectiveTabUri === tab.uri}
                            onClick={() =>
                                startTransition(() => {
                                    setSelectedTabUri(tab.uri)
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
                <PostContextProvider destinations={pin.defaultPostTimelines} profile={pin.defaultProfile}>
                    {/*
                      タブ切替はstartTransition内で行うため、切替先リストのitems取得でsuspendすると
                      既存のSuspense境界(表示中)では旧画面が保持され、タブ選択表示も動かず「押しても切り替わらない」ように見える。
                      pinごとに新しい境界をマウントすることで、遷移中でも即座にfallbackへ切り替わる(web版と同じ構成)。
                      フォールバックはRealtimeTimelineと同じ構造で組み、置き換わったときのレイアウトシフトを防ぐ
                    */}
                    <Suspense key={pin.uri} fallback={<TimelineSkeleton />}>
                        <TimelineWrap ref={timelineRef} pin={pin} />
                    </Suspense>
                    {/* Suspense境界の内側に置くとタブ切替(境界の付け替え)のたびに再マウントされて出現アニメーションが走るので外に出す */}
                    <ComposeFAB />
                </PostContextProvider>
            )}
        </>
    )
}

const TimelineWrap = (props: { pin: PinnedListItemClass; ref?: ScrollViewRef }) => {
    const { t } = useTranslation('', { keyPrefix: 'views.home' })
    const [list] = useSubscribe(props.pin.list)

    if (!list) return <Text>{t('listNotFound')}</Text>

    return <Timeline ref={props.ref} list={list} excludeSelf={props.pin.excludeSelf} />
}

const Timeline = (props: { list: List; excludeSelf?: boolean; ref?: ScrollViewRef }) => {
    const { client } = useClient()

    const [items] = useSubscribe(props.list.items)

    const self = semantics.homeTimeline(client.ccid, client.currentProfile)
    const timelines = useMemo(
        () => [...new Set([...(props.excludeSelf ? [] : [self]), ...items])],
        [self, items, props.excludeSelf]
    )

    return <RealtimeTimeline ref={props.ref} timelines={timelines} />
}
