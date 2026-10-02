import {
    ReactNode,
    startTransition,
    Suspense,
    useEffect,
    useCallback,
    useImperativeHandle,
    useMemo,
    useRef,
    useState
} from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { ScrollViewHandle, ScrollViewProps, ScrollViewRef } from '../types/ScrollView'

import { useClient } from '../contexts/Client'
import { useDomainStatus } from '../hooks/useDomainStatus'
import { Drawer } from '../components/Drawer'

import { Tabs, Tab, Text, Divider, Button } from '@concrnt/ui'
import { ErrorBoundary } from 'react-error-boundary'
import { useTranslation } from 'react-i18next'
import { Header } from '../components/Header'
import { View } from '../components/View'

import { ListSettings } from '../components/ListSettings'
import { RealtimeTimeline } from '../components/RealtimeTimeline'
import { TimelineSkeleton } from '../components/TimelineSkeleton'

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
import { Composer } from '../components/Composer'
import { ComposeFAB } from '../components/ComposeFAB'
import { PostContextProvider } from '../contexts/PostContext'
import { useIsMobile } from '../hooks/useIsMobile'

export const HomeView = (props: ScrollViewProps) => {
    const { t } = useTranslation('', { keyPrefix: 'views.home' })
    const { client } = useClient()
    // プロフィール・ピン留めリストは自ドメインのリソース
    const homeStatus = useDomainStatus()

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
                                hashTabUri={hashTabUri}
                                selectTab={selectTab}
                                listSettingsOpen={listSettingsOpen}
                                closeListSettings={() => setListSettingsOpen(false)}
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
    hashTabUri,
    selectTab,
    listSettingsOpen,
    closeListSettings,
    timelineSnapshot
}: {
    ref?: ScrollViewRef
    hashTabUri: string
    selectTab: (uri: string) => void
    listSettingsOpen: boolean
    closeListSettings: () => void
    timelineSnapshot: TimelineSnapshot | null
}) => {
    const { client } = useClient()

    const [pinnedLists] = useSubscribe(client.pinnedLists)
    const [listOrder] = usePreference('listOrder')

    const order = listOrder?.[client.currentProfile] ?? []
    const sortedPins = sortByListOrder(pinnedLists, order)
    const isMobile = useIsMobile()

    // ハッシュ無し・ピン解除済み等で該当しないときは先頭のピンにフォールバックする
    const effectiveTabUri = sortedPins.some((pin) => pin.uri === hashTabUri) ? hashTabUri : (sortedPins[0]?.uri ?? '')
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

    // インラインエディタの投稿先。リストのデフォルトを初期値にしつつ、その場で編集できるようにする。
    // 読み込み中のフォールバックにも同じComposerを出すので、Suspense境界の外(ここ)で持つ
    const [destinations, setDestinations] = useState<string[]>(pin?.defaultPostTimelines ?? [])
    // タブでリストを切り替えたらそのリストのデフォルト投稿先に戻す
    const [prevPinUri, setPrevPinUri] = useState(pin?.uri ?? '')
    if (prevPinUri !== (pin?.uri ?? '')) {
        setPrevPinUri(pin?.uri ?? '')
        setDestinations(pin?.defaultPostTimelines ?? [])
    }

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
                <PostContextProvider destinations={pin.defaultPostTimelines} profile={pin.defaultProfile}>
                    {/*
                      フォールバックはTimelineWrapが描く構造(Composer + タイムライン)と同じ形にしてレイアウトシフトを防ぐ。
                      Composerはリストの読み込みを待たなくても出せる(draft等はComposerDraftContextで共有されるので
                      本物に置き換わっても入力は引き継がれる)。投稿先候補はTimelineSearch contextからサスペンドせずに届く
                    */}
                    <Suspense
                        key={pin.uri}
                        fallback={
                            <TimelineSkeleton
                                headElement={
                                    isMobile ? undefined : (
                                        <>
                                            <div style={{ padding: CssVar.space(2) }}>
                                                <Composer
                                                    mode="normal"
                                                    autoGrow
                                                    destinations={destinations}
                                                    setDestinations={setDestinations}
                                                    defaultDestinations={pin.defaultPostTimelines}
                                                    initialProfile={pin.defaultProfile}
                                                />
                                            </div>
                                            <Divider />
                                        </>
                                    )
                                }
                            />
                        }
                    >
                        <TimelineWrap
                            ref={ref}
                            pin={pin}
                            initialTimeline={initialTimeline}
                            onHeadChange={isFirstList ? onHeadChange : undefined}
                            destinations={destinations}
                            setDestinations={setDestinations}
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
    destinations: string[]
    setDestinations: (destinations: string[]) => void
}) => {
    const { t } = useTranslation('', { keyPrefix: 'views.home' })
    const [list] = useSubscribe(props.pin.list)
    const isMobile = useIsMobile()

    if (!list) return <Text>{t('listNotFound')}</Text>

    return (
        <Timeline
            ref={props.ref}
            list={list}
            excludeSelf={props.pin.excludeSelf}
            initialTimeline={props.initialTimeline}
            onHeadChange={props.onHeadChange}
            headElement={
                // モバイルではインラインエディタは出さず、FABからモーダルで投稿する(app版と同じ体験)
                isMobile ? undefined : (
                    <>
                        <div style={{ padding: CssVar.space(2) }}>
                            <Composer
                                mode="normal"
                                autoGrow
                                destinations={props.destinations}
                                setDestinations={props.setDestinations}
                                defaultDestinations={props.pin.defaultPostTimelines}
                                initialProfile={props.pin.defaultProfile}
                            />
                        </div>
                        <Divider />
                    </>
                )
            }
        />
    )
}

const Timeline = (props: {
    list: List
    excludeSelf?: boolean
    initialTimeline?: TimelineSnapshot
    onHeadChange?: (timelines: string[], items: ChunklineItem[]) => void
    ref?: ScrollViewRef
    headElement?: ReactNode
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
            headElement={props.headElement}
            initialTimeline={props.initialTimeline}
            onHeadChange={props.onHeadChange}
        />
    )
}
