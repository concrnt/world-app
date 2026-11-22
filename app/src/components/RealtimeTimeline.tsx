import {
    Fragment,
    memo,
    startTransition,
    Suspense,
    useCallback,
    useEffect,
    useImperativeHandle,
    useMemo,
    useReducer,
    useRef,
    useState
} from 'react'
import { Client, isStaticTimelineURI } from '@concrnt/worldlib'
import { ScrollViewProps } from '../types/ScrollView'
import { useClient } from '../contexts/Client'
import { usePreference } from '../contexts/Preference'
import { useDomainStatus } from '../hooks/useDomainStatus'
import { ChunklineItem, TimelineItemWithUpdate, TimelineReader } from '@concrnt/client'
import { TimelineSnapshot } from '../lib/timelineSnapshot'
import { MessageContainer, MessageSnapshotContext, MuteFilterContext } from './message'
import { QueryTimelineContext } from './QueryTimeline'
import { Avatar, CssVar, Divider } from '@concrnt/ui'
import { ErrorBoundary } from 'react-error-boundary'
import { PullToRefresh } from './PullToRefresh'
import { MessageSkeleton } from './message/MessageSkeleton'
import { RenderError } from './message/RenderError'
import { Loading } from './message/Loading'
import { MdArrowUpward } from 'react-icons/md'

interface NewArrivalIcon {
    id: string
    author: string
    src: string
}

interface Props extends ScrollViewProps {
    timelines: string[]
    // 起動時に前回表示していた投稿列を先に描くためのスナップショット(マウント時に1回だけ取り込む)。
    // タイムライン構成(timelines)が一致するときだけ使い、本物の先頭ページが届くまで
    // pull-to-refresh中の見た目(先頭スピナー)で表示する
    initialTimeline?: TimelineSnapshot
    // 表示中の先頭16件が変わったときに呼ばれる(スナップショットの保存用)
    onHeadChange?: (timelines: string[], items: ChunklineItem[]) => void
    // socket購読なしで読む(静的タイムラインなど新着が来ないもの)
    noRealtime?: boolean
}

const SCROLL_HALT_THRESHOLD = 100

// 画面が埋まっていないときの追い読み判定の猶予(ms)。初期値から判定ごとに倍増し上限で頭打ち
const FILL_DELAY_MIN = 100
const FILL_DELAY_MAX = 1000

export const RealtimeTimeline = (props: Props) => {
    const { client } = useClient()
    const homeStatus = useDomainStatus()

    // 自ドメインがオフラインでも、単一タイムラインならそのオーナーのドメインから直接読める。
    // 解決が済むまでは自ドメインのまま読む(一時的なオフライン遷移のたびに表示中のreaderを作り直さない)。
    // 静的タイムライン(https manifest)の読み出しは自ドメイン経由のみ(manifestのホストはconcrntサーバーではない)
    const directOwner =
        !homeStatus.online && props.timelines.length === 1 && !isStaticTimelineURI(props.timelines[0])
            ? URL.parse(props.timelines[0])?.host
            : undefined
    const [resolved, setResolved] = useState<{ owner: string; fqdn?: string } | undefined>(undefined)
    useEffect(() => {
        if (!directOwner) return
        let isCancelled = false
        client.api
            .resolveDomain(directOwner)
            .catch(() => undefined)
            .then((fqdn) => {
                if (!isCancelled) setResolved({ owner: directOwner, fqdn })
            })
        return () => {
            isCancelled = true
        }
    }, [client, directOwner])
    const hostOverride =
        directOwner && resolved?.owner === directOwner && resolved.fqdn !== client.api.defaultHost
            ? resolved.fqdn
            : undefined

    // タイムライン構成が変わったら中身ごと作り直す(呼び出し側が毎レンダー新規配列を渡しても、内容が同じなら維持)
    return (
        <RealtimeTimelineInner
            key={props.timelines.join('|') + (props.noRealtime ? '|norealtime' : '')}
            {...props}
            hostOverride={hostOverride}
        />
    )
}

const RealtimeTimelineInner = (props: Props & { hostOverride?: string }) => {
    const { client } = useClient()
    const { hostOverride } = props
    // このインスタンスが読むタイムライン構成は固定(変わったら外側でkeyごと作り直される)
    const [timelines] = useState(props.timelines)

    // 起動時スナップショット。本物の先頭ページに差し替えたらundefinedになる(以後は使わない)。
    // 表示中はpull-to-refresh実行中の見た目にし、スケルトン・末尾表示は出さない
    const [snapshot, setSnapshot] = useState(() =>
        props.initialTimeline && props.initialTimeline.timelines.join('|') === timelines.join('|')
            ? props.initialTimeline
            : undefined
    )
    const snapshotRef = useRef(snapshot)
    const seededItems = useMemo(() => snapshot?.items.map((item) => ({ ...item, lastUpdate: new Date() })), [snapshot])
    // スナップショット表示のまま先頭取得に失敗した(オフライン)。自ドメイン復帰時に取り直す
    const listenFailedRef = useRef(false)
    const saveTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
    const onHeadChangeRef = useRef(props.onHeadChange)
    useEffect(() => {
        onHeadChangeRef.current = props.onHeadChange
    }, [props.onHeadChange])
    // 変えても購読(readerのeffect)を作り直さないようrefで読む
    const [mutedUsers] = usePreference('mutedUsers')
    const mutedUsersRef = useRef(mutedUsers)
    useEffect(() => {
        mutedUsersRef.current = mutedUsers
    }, [mutedUsers])

    const loadingRef = useRef(true)
    const fillDelayRef = useRef(FILL_DELAY_MIN)
    const [loading, setLoading] = useState(snapshot === undefined)

    // 表示はreaderRef.current.bodyを直接読み、readerの更新はforceUpdateで反映する
    const readerRef = useRef<TimelineReader | undefined>(undefined)
    // readerをどの取得元(Client・ホスト)で初期化したか。Activityのhidden→visible復帰やStrictModeでは
    // refを残したままeffectだけが再実行されるので、取得元が同じなら作り直さず購読だけ戻す
    const initializedRef = useRef<{ client: Client; hostOverride?: string } | undefined>(undefined)
    const [, forceUpdate] = useReducer((x: number) => x + 1, 0)

    const [isFetching, setIsFetching] = useState(snapshot !== undefined)

    /** スクロール位置の追跡。PullToRefreshが先頭判定に使う */
    const scrollPositionRef = useRef<number>(0)

    const [hasMoreData, setHasMoreData] = useState<boolean>(snapshot !== undefined)
    const [initialLoaded, setInitialLoaded] = useState(snapshot !== undefined)

    // 表示中の先頭16件をデバウンスして保存させる(先頭リストのみonHeadChangeが渡される)。
    // スナップショット表示中は本物がまだ無いので保存しない
    const scheduleSave = useCallback((t: TimelineReader) => {
        if (!onHeadChangeRef.current || snapshotRef.current || t.body.length === 0) return
        clearTimeout(saveTimerRef.current)
        saveTimerRef.current = setTimeout(() => {
            onHeadChangeRef.current?.(t.timelines, t.body.slice(0, 16))
        }, 1000)
    }, [])

    /** 新着バッジ用ステート */
    const [newArrivals, setNewArrivals] = useState<NewArrivalIcon[]>([])
    const newArrivalsRef = useRef<NewArrivalIcon[]>([])

    // refとstateを同期
    useEffect(() => {
        newArrivalsRef.current = newArrivals
    }, [newArrivals])

    // スナップショット表示から本物の先頭ページへ差し替える。各投稿を先読みしてからtransition内で
    // 切り替えるので、Cell(key=href)がスナップショットからuse()に切り替わってもスケルトンには戻らず、
    // ネスト先(リプライ/リルート元)が未解決でも解決まで旧表示が保持される
    const swapToLive = useCallback(
        async (t: TimelineReader) => {
            await Promise.allSettled(
                t.body.map((item) =>
                    item.href
                        ? client.getMessage(item.href, item.source ? new URL(item.source).hostname : undefined)
                        : undefined
                )
            )
            snapshotRef.current = undefined
            startTransition(() => {
                setSnapshot(undefined)
                setIsFetching(false)
                forceUpdate()
            })
            scheduleSave(t)
        },
        [client, scheduleSave]
    )

    // このタイムラインを購読しているホスト(先頭取得・socketとも同じ)。復帰時の再試行キーにする
    const subscribedStatus = useDomainStatus(hostOverride ?? client.api.defaultHost)

    useEffect(() => {
        const current = readerRef.current
        const initialized = initializedRef.current
        const resumable =
            initialized?.client === client && initialized.hostOverride === hostOverride ? current : undefined
        const t = resumable ?? client.newTimelineReader({ withoutSocket: props.noRealtime ?? false, hostOverride })

        t.onUpdate = () => {
            scheduleSave(t)
            startTransition(() => {
                forceUpdate()
            })
        }
        t.onNewItem = (item) => {
            if (!t.haltUpdate) return
            if (!item.href) return

            client.getMessage(item.href, item.source ? new URL(item.source).hostname : undefined).then((msg) => {
                if (readerRef.current !== t) return
                if (!msg) return
                if (mutedUsersRef.current.includes(msg.author)) return
                const icon = msg.authorProfile?.avatar
                if (!icon) return
                setNewArrivals((prev) => {
                    if (prev.find((e) => e.src === icon)) return prev
                    return [{ id: item.href!, author: msg.author, src: icon }, ...prev]
                })
            })
        }

        if (resumable) {
            t.resume()
            return () => {
                t.dispose()
            }
        }

        console.log('Initializing timeline reader for timelines:', timelines)
        readerRef.current = t
        initializedRef.current = { client, hostOverride }
        if (snapshotRef.current) {
            // 起動時スナップショット: 先頭ページが届くまでbodyに前回の投稿列を置いておく
            // (listen失敗時もbodyは消えないので、オフラインならそのまま残る)
            const seeded = snapshotRef.current.items.map((item) => ({ ...item, lastUpdate: new Date() }))
            t.body = seeded
            t.chunkedBody = [[...seeded]]
        } else if (current) {
            // Client差し替え・取得ホストの切り替え: 先頭ページが届くまで表示中の投稿列を残す
            t.body = current.body
            t.chunkedBody = current.chunkedBody
            t.haltUpdate = current.haltUpdate
        }
        loadingRef.current = true
        t.listen(timelines)
            .then((hasMoreData) => {
                if (readerRef.current !== t) return
                setHasMoreData(hasMoreData)
                if (!snapshotRef.current) return
                if (t.headLoaded) {
                    swapToLive(t)
                } else {
                    listenFailedRef.current = true
                    setIsFetching(false)
                }
            })
            .catch((err) => {
                console.error('Failed to initialize timeline reader:', err)
            })
            .finally(() => {
                if (readerRef.current !== t) return
                loadingRef.current = false
                setLoading(false)
                setInitialLoaded(true)
            })
        return () => {
            t.dispose()
        }
    }, [client, hostOverride, props.noRealtime, timelines, scheduleSave, swapToLive])

    const scrollRef = useRef<HTMLDivElement>(null)

    useImperativeHandle(props.ref, () => ({
        scrollToTop: () => {
            if (scrollRef.current) {
                scrollRef.current.scrollTo({ top: 0, behavior: 'smooth' })
            }
        },
        isAtTop: () => (scrollRef.current?.scrollTop ?? 0) <= 0
    }))

    /** Pull to Refreshのリフレッシュ処理 */
    const onRefresh = useCallback(async () => {
        if (!readerRef.current) return
        console.log('Pull to refresh: reloading timeline')
        setNewArrivals([])
        setIsFetching(true)
        try {
            await readerRef.current.reload()
            if (snapshotRef.current && readerRef.current.headLoaded) {
                await swapToLive(readerRef.current)
                return
            }
            await new Promise((resolve) => setTimeout(resolve, 500))
        } finally {
            setIsFetching(false)
        }
    }, [swapToLive])

    // スナップショット表示のまま先頭取得に失敗していた場合、購読先ホストの復帰時に無音で本物へ差し替える
    // (投稿は既に見えているので、コールド起動のような再試行導線は出さない)
    useEffect(() => {
        if (!subscribedStatus.online) return
        if (!snapshotRef.current || !listenFailedRef.current) return
        listenFailedRef.current = false
        // まだ届かなければスナップショット表示のまま(次の復帰で再試行)。reloadのrejectをunhandledにしない
        onRefresh().catch(() => {
            listenFailedRef.current = true
        })
    }, [subscribedStatus.online, subscribedStatus.onlineSince, onRefresh])

    // リアクション等のcommit後に、そのアイテムだけ再取得させる。
    // socketのassociatedイベント任せだとcommit応答より遅れて届いたときに
    // useOptimisticのrevertが先に走り、リアクションが一瞬消える
    const itemUpdated = useCallback((href: string) => {
        readerRef.current?.updateItem(href)
    }, [])

    /** 新着バッジクリック時の処理 */
    const handleNewArrivalClick = useCallback(() => {
        setNewArrivals([])
        if (scrollRef.current) {
            scrollRef.current.scrollTo({ top: 0, behavior: 'smooth' })
        }
        onRefresh()
    }, [onRefresh])

    useEffect(() => {
        const el = scrollRef.current
        if (!el) return
        if (!initialLoaded) return

        const handleScroll = () => {
            // PullToRefresh用にスクロール位置を記録
            scrollPositionRef.current = el.scrollTop

            // haltUpdate制御：スクロールが閾値を超えたら自動更新を停止
            if (readerRef.current) {
                readerRef.current.haltUpdate = el.scrollTop > SCROLL_HALT_THRESHOLD || newArrivalsRef.current.length > 0
            }

            if (el.scrollHeight - el.scrollTop - el.clientHeight < 500) {
                if (loadingRef.current) return
                if (!hasMoreData) return
                if (!readerRef.current) return

                console.log('Reading more...')

                loadingRef.current = true
                setLoading(true)
                readerRef.current
                    ?.readMore(8)
                    .then((hasMore) => {
                        setHasMoreData(hasMore)
                    })
                    .catch((e) => {
                        console.error('Failed to read more', e)
                        console.log(readerRef.current?.body[readerRef.current.body.length - 1])
                    })
                    .finally(() => {
                        loadingRef.current = false
                        setLoading(false)
                        console.log('Finished reading more')
                    })
            }
        }

        el.addEventListener('scroll', handleScroll)
        // コンテンツがコンテナを満たしていないとscrollイベントが発生せず次ページが永遠に読まれないため、
        // 読み込みが落ち着いたら一度だけ手動で判定する(不足していればreadMore→loadingが戻って再判定)。
        // 猶予は短く始めて判定でreadMoreが走るたびに倍にし(上限あり)、埋まった/読み切ったら初期値に戻す
        // スナップショット起動ではloading/hasMoreDataが差し替え前後で変わらないため、差し替え(snapshot解除)でも再判定する
        const fill = setTimeout(() => {
            if (loadingRef.current) return
            handleScroll()
            fillDelayRef.current = loadingRef.current
                ? Math.min(fillDelayRef.current * 2, FILL_DELAY_MAX)
                : FILL_DELAY_MIN
        }, fillDelayRef.current)
        return () => {
            el.removeEventListener('scroll', handleScroll)
            clearTimeout(fill)
        }
    }, [hasMoreData, initialLoaded, loading, snapshot])

    const maxDisplayAvatars = 4
    const displayedArrivals = newArrivals.slice(0, maxDisplayAvatars)
    const extraCount = newArrivals.length - maxDisplayAvatars

    return (
        <PullToRefresh positionRef={scrollPositionRef} isFetching={isFetching} onRefresh={onRefresh}>
            <div
                style={{
                    position: 'relative',
                    display: 'flex',
                    flex: 1,
                    flexDirection: 'column',
                    overflow: 'hidden'
                }}
            >
                <div
                    style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '8px',
                        padding: '8px 0',
                        overflowX: 'hidden',
                        overflowY: 'auto',
                        // 読み込み後にスクロールバーが出て内容幅が変わらないよう、最初からガターを確保しておく
                        scrollbarGutter: 'stable',
                        overscrollBehaviorY: 'none',
                        touchAction: 'pan-y'
                    }}
                    ref={scrollRef}
                >
                    {/* 実際のCellと同じくDividerを挟み、読み込み完了時にレイアウトが動かないようにする */}
                    {!initialLoaded &&
                        Array.from({ length: 10 }).map((_, i) => (
                            <Fragment key={i}>
                                <div style={{ padding: `0 ${CssVar.space(2)}` }}>
                                    <MessageSkeleton />
                                </div>
                                <Divider inset />
                            </Fragment>
                        ))}
                    <QueryTimelineContext.Provider value={{ update: itemUpdated }}>
                        <MessageSnapshotContext.Provider value={snapshot?.messages}>
                            <MuteFilterContext.Provider value={true}>
                                {(seededItems ?? readerRef.current?.body ?? []).map((item, i) => (
                                    // 静的タイムラインの同梱コンテンツはhrefを持たないので、時刻+位置で代用する
                                    <Cell
                                        key={item.href ?? `content:${item.timestamp.getTime()}:${i}`}
                                        item={item}
                                        lastUpdate={item.lastUpdate?.getTime() ?? 0}
                                    />
                                ))}
                            </MuteFilterContext.Provider>
                        </MessageSnapshotContext.Provider>
                    </QueryTimelineContext.Provider>
                    {loading && <Loading message={'Loading...'} />}
                    {!hasMoreData && (
                        <div
                            style={{
                                padding: '8px',
                                fontSize: '12px',
                                color: '#888',
                                width: '100%',
                                height: '100px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                            }}
                        >
                            -- End of Timeline --
                        </div>
                    )}
                </div>
                <div
                    style={{
                        position: 'absolute',
                        top: '8px',
                        left: 0,
                        right: 0,
                        display: 'flex',
                        justifyContent: 'center',
                        pointerEvents: 'none',
                        transition: 'opacity 0.2s ease, transform 0.2s ease',
                        opacity: newArrivals.length > 0 ? 1 : 0,
                        transform: newArrivals.length > 0 ? 'scale(1)' : 'scale(0.8)'
                    }}
                >
                    <button
                        onClick={handleNewArrivalClick}
                        style={{
                            pointerEvents: newArrivals.length > 0 ? 'auto' : 'none',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                            padding: '4px 12px',
                            border: 'none',
                            borderRadius: '100px',
                            backgroundColor: CssVar.contentLink,
                            color: '#fff',
                            cursor: 'pointer',
                            boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
                            fontSize: '14px'
                        }}
                    >
                        <MdArrowUpward size={16} />
                        <div style={{ display: 'flex', alignItems: 'center' }}>
                            {displayedArrivals.map((item, i) => (
                                <div
                                    key={item.id}
                                    style={{
                                        marginLeft: i > 0 ? '-6px' : '0',
                                        borderRadius: '50%',
                                        overflow: 'hidden',
                                        border: '1.5px solid #fff',
                                        width: '22px',
                                        height: '22px',
                                        flexShrink: 0
                                    }}
                                >
                                    <Avatar
                                        ccid={item.author}
                                        src={item.src}
                                        style={{
                                            width: '22px',
                                            height: '22px',
                                            borderRadius: '50%'
                                        }}
                                    />
                                </div>
                            ))}
                            {extraCount > 0 && (
                                <div
                                    style={{
                                        marginLeft: '-6px',
                                        width: '22px',
                                        height: '22px',
                                        borderRadius: '50%',
                                        backgroundColor: 'rgba(255,255,255,0.3)',
                                        border: '1.5px solid #fff',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        fontSize: '10px',
                                        fontWeight: 'bold',
                                        color: '#fff',
                                        flexShrink: 0
                                    }}
                                >
                                    +{extraCount}
                                </div>
                            )}
                        </div>
                    </button>
                </div>
            </div>
        </PullToRefresh>
    )
}

interface CellProps {
    item: TimelineItemWithUpdate
    lastUpdate: number
}

const Cell = memo<CellProps>(({ item }: CellProps) => {
    return (
        <>
            <ErrorBoundary FallbackComponent={RenderError}>
                <div
                    style={{
                        padding: `0 ${CssVar.space(2)}`,
                        contentVisibility: 'auto',
                        containIntrinsicSize: 'auto 120px',
                        // スキップ中(画面外・Activity復帰直後)の行がflexで縮むと、Chromium系では復帰時に
                        // 内容高が画面に満たずスクロール位置が0にクランプされる
                        flexShrink: 0
                    }}
                >
                    <Suspense key={item.href ?? 'content'} fallback={<MessageSkeleton />}>
                        <MessageContainer uri={item.href} source={item.source} content={item.content} />
                    </Suspense>
                </div>
            </ErrorBoundary>
            <Divider inset />
        </>
    )
})
Cell.displayName = 'RealtimeTimelineCell'
