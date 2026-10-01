import {
    startTransition,
    Suspense,
    useEffect,
    useCallback,
    useImperativeHandle,
    useMemo,
    useRef,
    useState
} from 'react'
import { ScrollViewHandle, ScrollViewProps, ScrollViewRef } from '../types/ScrollView'

import { useClient } from '../contexts/Client'
import { useDomainStatus } from '../hooks/useDomainStatus'
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
import { ChunklineItem } from '@concrnt/client'
import { loadTimelineSnapshot, saveTimelineSnapshot, TimelineSnapshot } from '../lib/timelineSnapshot'
import { CssVar } from '../types/Theme'
import { ListName } from '../components/ListName'
import { ProfileEditor } from '../components/ProfileEditor'
import { useSubscribe } from '../hooks/useSubscribe'
import { usePreference } from '../contexts/Preference'
import { sortByListOrder } from '../utils/listOrder'

export const HomeView = (props: ScrollViewProps) => {
    const { t } = useTranslation('', { keyPrefix: 'views.home' })
    const { client } = useClient()
    // プロフィール・ピン留めリストは自ドメインのリソース
    const homeStatus = useDomainStatus()

    const scrollRef = useRef<ScrollViewHandle>(null)
    useImperativeHandle(props.ref, () => ({
        scrollToTop: () => scrollRef.current?.scrollToTop(),
        reselect: () => scrollRef.current?.reselect?.()
    }))

    const [selectedTabUri, setSelectedTabUri] = useState<string>('')
    const [listSettingsOpen, setListSettingsOpen] = useState(false)
    // 起動時スナップショット(前回表示の投稿列)。HomeMainをマウントする前にKVSから読み終えておく。
    // HomeMainの中でサスペンドさせると、外側Suspenseの再試行中は入れ子のフォールバックがcommitされず
    // 投稿が数百ms遅れて出るため、サスペンドではなくstateで待つ。スナップショットがあるときは
    // 各リストのlist/itemsも(KVSにあるはずなので)先に読んで、TimelineSkeletonのちらつきを無くす。
    // 初回以降は値を保持するので、プロフィール切替でHomeMainは再マウントしない
    const [timelineSnapshot, setTimelineSnapshot] = useState<TimelineSnapshot | null | undefined>(undefined)
    useEffect(() => {
        let isCancelled = false
        loadTimelineSnapshot(client)
            .then(async (snapshot) => {
                if (snapshot) {
                    const pins = await client.pinnedLists.value().catch(() => [])
                    await Promise.all(
                        pins.map((pin) =>
                            pin.list
                                .value()
                                .then((list) => list?.items.value())
                                .catch(() => {})
                        )
                    )
                }
                return snapshot
            })
            .catch(() => null)
            .then((snapshot) => {
                if (!isCancelled) setTimelineSnapshot(snapshot)
            })
        return () => {
            isCancelled = true
        }
    }, [client])

    // fix default settings
    // 一度閉じたらeffect再実行(言語ロード等)で再表示しないためのガード
    const profileSetupOpened = useRef(false)
    const [profileSetupOpen, setProfileSetupOpen] = useState(false)
    useEffect(() => {
        if (!client) return
        // オフライン時はプロフィールがキャッシュから読めなかっただけの可能性があり、
        // そもそもcommitもできないので表示しない。復帰直後も同様なので、取り直し(refreshFreshResources)の
        // 完了を待ってから判定する
        if (!homeStatus.online) return
        if (profileSetupOpened.current) return
        let isCancelled = false
        client.refreshFreshResources().then(() => {
            if (isCancelled || profileSetupOpened.current) return
            if (!(client.currentProfile in client.profiles)) {
                profileSetupOpened.current = true
                setProfileSetupOpen(true)
            }
        })
        return () => {
            isCancelled = true
        }
    }, [client, homeStatus.online, homeStatus.onlineSince])

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
                        <HomeLoadError resetErrorBoundary={resetErrorBoundary} />
                    )}
                >
                    {timelineSnapshot !== undefined && (
                        <Suspense>
                            <HomeMain
                                ref={scrollRef}
                                selectedTabUri={selectedTabUri}
                                setSelectedTabUri={setSelectedTabUri}
                                timelineSnapshot={timelineSnapshot}
                            />
                        </Suspense>
                    )}
                </ErrorBoundary>
            </View>
        </>
    )
}

// 読み込み失敗の表示。オフライン起動で失敗していた場合、自ドメインの復帰時に自動で再試行する
// (worldlibが復帰通知の前に失敗したCachedPromiseを破棄しているので、resetは新しい取得になる)
const HomeLoadError = ({ resetErrorBoundary }: { resetErrorBoundary: () => void }) => {
    const { t } = useTranslation('', { keyPrefix: 'views.home' })
    const homeStatus = useDomainStatus()
    const [errorAt] = useState(() => Date.now())
    useEffect(() => {
        if (homeStatus.online && homeStatus.onlineSince > errorAt) resetErrorBoundary()
    }, [homeStatus.online, homeStatus.onlineSince, errorAt, resetErrorBoundary])
    return (
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
    )
}

const HomeMain = ({
    ref,
    selectedTabUri,
    setSelectedTabUri,
    timelineSnapshot
}: {
    ref?: ScrollViewRef
    selectedTabUri: string
    setSelectedTabUri: (uri: string) => void
    timelineSnapshot: TimelineSnapshot | null
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
    // 起動時スナップショット(前回表示の投稿列)の保存は先頭リストだけ。
    // 注入はさらに「起動時に最初に選ばれたタブからまだ遷移していない」間だけ行う。タブを移って戻ってきたときの
    // 再マウント(Suspense key=pin.uri)は起動ではないので、通常どおりスケルトン→ネットワークにする
    const isFirstList = pin !== undefined && pin.uri === sortedPins[0]?.uri
    const [initialTabUri] = useState(effectiveTabUri)
    const [tabChanged, setTabChanged] = useState(false)
    if (!tabChanged && effectiveTabUri !== initialTabUri) {
        setTabChanged(true)
    }
    const initialTimeline = isFirstList && !tabChanged ? (timelineSnapshot ?? undefined) : undefined
    const onHeadChange = useCallback(
        (timelines: string[], items: ChunklineItem[]) => {
            saveTimelineSnapshot(client, timelines, items).catch((e) => {
                console.error('Failed to save timeline snapshot:', e)
            })
        },
        [client]
    )

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
                        <TimelineWrap
                            ref={timelineRef}
                            pin={pin}
                            initialTimeline={initialTimeline}
                            onHeadChange={isFirstList ? onHeadChange : undefined}
                        />
                    </Suspense>
                    {/* Suspense境界の内側に置くとタブ切替(境界の付け替え)のたびに再マウントされて出現アニメーションが走るので外に出す */}
                    <ComposeFAB />
                </PostContextProvider>
            )}
        </>
    )
}

const TimelineWrap = (props: {
    pin: PinnedListItemClass
    initialTimeline?: TimelineSnapshot
    onHeadChange?: (timelines: string[], items: ChunklineItem[]) => void
    ref?: ScrollViewRef
}) => {
    const { t } = useTranslation('', { keyPrefix: 'views.home' })
    const [list] = useSubscribe(props.pin.list)

    if (!list) return <Text>{t('listNotFound')}</Text>

    return (
        <Timeline
            ref={props.ref}
            list={list}
            excludeSelf={props.pin.excludeSelf}
            initialTimeline={props.initialTimeline}
            onHeadChange={props.onHeadChange}
        />
    )
}

const Timeline = (props: {
    list: List
    excludeSelf?: boolean
    initialTimeline?: TimelineSnapshot
    onHeadChange?: (timelines: string[], items: ChunklineItem[]) => void
    ref?: ScrollViewRef
}) => {
    const { client } = useClient()

    const [items] = useSubscribe(props.list.items)

    const self = semantics.homeTimeline(client.ccid, client.currentProfile)
    const timelines = useMemo(
        () => [...new Set([...(props.excludeSelf ? [] : [self]), ...items])],
        [self, items, props.excludeSelf]
    )

    return (
        <RealtimeTimeline
            ref={props.ref}
            timelines={timelines}
            initialTimeline={props.initialTimeline}
            onHeadChange={props.onHeadChange}
        />
    )
}
