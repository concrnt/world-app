import {
    Fragment,
    memo,
    ReactNode,
    startTransition,
    Suspense,
    useCallback,
    useEffect,
    useImperativeHandle,
    useLayoutEffect,
    useMemo,
    useRef,
    useState
} from 'react'
import { isStaticTimelineURI } from '@concrnt/worldlib'
import { ScrollViewProps } from '../types/ScrollView'
import { useClient } from '../contexts/Client'
import { useDomainStatus } from '../hooks/useDomainStatus'
import { useRefWithUpdate } from '../hooks/useRefWithUpdate'
import { ChunklineItem, TimelineItemWithUpdate, TimelineReader } from '@concrnt/client'
import { TimelineSnapshot } from '../lib/timelineSnapshot'
import { MessageContainer, MessageSnapshotContext } from './message'
import { QueryTimelineContext } from './QueryTimeline'
import { Avatar, CssVar, Divider } from '@concrnt/ui'
import { ErrorBoundary } from 'react-error-boundary'
import { PullToRefresh } from './PullToRefresh'
import { MessageSkeleton } from './message/MessageSkeleton'
import { RenderError } from './message/RenderError'
import { Loading } from './message/Loading'
import { useIsMobile } from '../hooks/useIsMobile'
import { MdArrowUpward } from 'react-icons/md'

interface NewArrivalIcon {
    id: string
    author: string
    src: string
}

interface Props extends ScrollViewProps {
    timelines: string[]
    headElement?: ReactNode
    noRealtime?: boolean
    // 起動時に前回表示していた投稿列を先に描くためのスナップショット(マウント時に1回だけ取り込む)。
    // タイムライン構成(timelines)が一致するときだけ使い、本物の先頭ページが届くまで
    // pull-to-refresh中の見た目(先頭スピナー)で表示する
    initialTimeline?: TimelineSnapshot
    // 表示中の先頭16件が変わったときに呼ばれる(スナップショットの保存用)
    onHeadChange?: (timelines: string[], items: ChunklineItem[]) => void
}

const SCROLL_HALT_THRESHOLD = 100

// 画面が埋まっていないときの追い読み判定の猶予(ms)。初期値から判定ごとに倍増し上限で頭打ち
const FILL_DELAY_MIN = 100
const FILL_DELAY_MAX = 1000

export const RealtimeTimeline = (props: Props) => {
    const { client } = useClient()
    const homeStatus = useDomainStatus()
    const isMobile = useIsMobile()

    // 起動時スナップショット。本物の先頭ページに差し替えたらundefinedになる(以後は使わない)。
    // 表示中はpull-to-refresh実行中の見た目にし、スケルトン・末尾表示は出さない
    const [snapshot, setSnapshot] = useState(() =>
        props.initialTimeline && props.initialTimeline.timelines.join('|') === props.timelines.join('|')
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

    const loadingRef = useRef(true)
    const fillDelayRef = useRef(FILL_DELAY_MIN)
    const [loading, setLoading] = useState(snapshot === undefined)
    const [reader, update] = useRefWithUpdate<TimelineReader | undefined>(undefined)

    const [isFetching, setIsFetching] = useState(snapshot !== undefined)

    /** スクロール位置の追跡。PullToRefreshが先頭判定に使う */
    const scrollPositionRef = useRef<number>(0)

    const [hasMoreData, setHasMoreData] = useState<boolean>(snapshot !== undefined)
    const hasMoreDataRef = useRef(hasMoreData)
    hasMoreDataRef.current = hasMoreData
    const [initialLoaded, setInitialLoaded] = useState(snapshot !== undefined)
    // listenがbodyを先頭ページで置き換える前に、スクロールで足した投稿を覚えておく
    const readAheadRef = useRef<TimelineItemWithUpdate[]>([])

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
            if (!client) return
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
                update()
            })
            scheduleSave(t)
        },
        [client, update, scheduleSave]
    )

    // 呼び出し側が毎レンダー新規配列を渡しても、内容が同じならreaderを作り直さないための内容キー
    const timelinesKey = props.timelines.join('|')

    // 自ドメインがオフラインでも、単一タイムラインならそのホストから直接読める。
    // reader再生成のトリガーは解決済みのhostOverride値の変化のみにする
    // (online自体を依存にすると、一時的なオフライン遷移のたびに表示中のリーダーが破棄されてしまう)
    const [hostOverride, setHostOverride] = useState<string | undefined>(undefined)
    useEffect(() => {
        // 静的タイムライン(https manifest)の読み出しは自ドメイン経由のみ(manifestのホストはconcrntサーバーではない)
        if (!client || homeStatus.online || props.timelines.length !== 1 || isStaticTimelineURI(props.timelines[0])) {
            setHostOverride(undefined)
            return
        }
        let isCancelled = false
        const owner = URL.parse(props.timelines[0])?.host
        if (!owner) {
            setHostOverride(undefined)
            return
        }
        client.api
            .resolveDomain(owner)
            .catch(() => undefined)
            .then((fqdn) => {
                if (isCancelled) return
                setHostOverride(fqdn === client.api.defaultHost ? undefined : fqdn)
            })
        return () => {
            isCancelled = true
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [client, homeStatus.online, timelinesKey])

    // このタイムラインを購読しているホスト(先頭取得・socketとも同じ)。復帰時の再試行キーにする
    const subscribedStatus = useDomainStatus(hostOverride ?? client.api.defaultHost)

    useEffect(() => {
        // 再アタッチパス: effectが再実行されても、タイムライン構成が同じなら
        // 既存readerのbodyとDOMを保ったままsocket購読だけ復帰する
        // (スクロール位置と表示内容を維持するため、スケルトン表示には戻さない)
        const existing = reader.current
        if (
            client &&
            existing &&
            existing.timelines.join('|') === timelinesKey &&
            existing.hostOverride === hostOverride &&
            (existing.socket !== undefined) === !(props.noRealtime ?? false) &&
            existing.body.length > 0
        ) {
            existing.onUpdate = () => {
                scheduleSave(existing)
                startTransition(() => {
                    update()
                })
            }
            existing.onNewItem = (item) => {
                if (!existing.haltUpdate) return
                if (!item.href) return

                client.getMessage(item.href, item.source ? new URL(item.source).hostname : undefined).then((msg) => {
                    if (!msg) return
                    const icon = msg.authorProfile?.avatar
                    if (!icon) return
                    setNewArrivals((prev) => {
                        if (prev.find((e) => e.src === icon)) return prev
                        return [{ id: item.href!, author: msg.author, src: icon }, ...prev]
                    })
                })
            }
            existing.resume()
            return () => {
                existing.dispose()
            }
        }

        console.log('Initializing timeline reader for timelines:', props.timelines)
        let isCancelled = false
        const seeded = seededItems
        if (!seeded) setInitialLoaded(false)
        setNewArrivals([])
        const request = async () => {
            if (!client) return

            return client
                .newTimelineReader({ withoutSocket: props.noRealtime ?? false, hostOverride })
                .catch(() => client.newTimelineReader({ withoutSocket: true, hostOverride }))
                .then((t) => {
                    if (isCancelled) return
                    t.haltUpdate = false
                    t.onUpdate = () => {
                        scheduleSave(t)
                        startTransition(() => {
                            update()
                        })
                    }

                    t.onNewItem = (item) => {
                        if (isCancelled) return
                        if (!t.haltUpdate) return
                        if (!item.href) return

                        client
                            .getMessage(item.href, item.source ? new URL(item.source).hostname : undefined)
                            .then((msg) => {
                                if (isCancelled) return
                                if (!msg) return
                                const icon = msg.authorProfile?.avatar
                                if (!icon) return
                                setNewArrivals((prev) => {
                                    if (prev.find((e) => e.src === icon)) return prev
                                    return [{ id: item.href!, author: msg.author, src: icon }, ...prev]
                                })
                            })
                    }

                    reader.current = t
                    if (seeded) {
                        // 起動時スナップショット: 先頭ページが届くまでbodyに前回の投稿列を置いておく
                        // (listen失敗時もbodyは消えないので、オフラインならそのまま残る)
                        t.body = [...seeded]
                        t.chunkedBody = [[...seeded]]
                        setIsFetching(true)
                    }
                    t.listen(props.timelines)
                        .then((hasMoreData) => {
                            // 先頭取得はbodyを置き換える。それより前に追い読みした古い投稿を戻す
                            const fetched = new Set(t.body.map((item) => item.href))
                            const oldest = t.body.reduce(
                                (min, item) => Math.min(min, item.timestamp.getTime()),
                                Infinity
                            )
                            const older = readAheadRef.current.filter(
                                (item) => !fetched.has(item.href) && item.timestamp.getTime() < oldest
                            )
                            if (older.length > 0) {
                                t.body = [...t.body, ...older]
                                t.chunkedBody.push(older)
                                update()
                            }
                            setHasMoreData(older.length > 0 || hasMoreData)
                            if (!snapshotRef.current) return
                            if (t.headLoaded) {
                                swapToLive(t)
                            } else {
                                listenFailedRef.current = true
                                setIsFetching(false)
                            }
                        })
                        .finally(() => {
                            loadingRef.current = false
                            setLoading(false)
                            setInitialLoaded(true)
                        })
                    return t
                })
        }
        const mt = request().catch((err) => {
            console.error('Failed to initialize timeline reader:', err)
            loadingRef.current = false
            setLoading(false)
            setInitialLoaded(true)
            return undefined
        })
        return () => {
            isCancelled = true
            mt.then((t) => {
                t?.dispose()
            })
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [client, reader, timelinesKey, update, hostOverride, props.noRealtime])

    const scrollRef = useRef<HTMLDivElement>(null)

    // Activityがhidden(display:none)の間、ブラウザは内側スクロールコンテナの位置を破棄するため、
    // visible復帰(=effect再マウント)時にscrollPositionRefから復元する。
    // 復帰時のlayout effectはdisplayが戻る前に実行されるため(この時点の書き込みは0にクランプされる)、
    // 書き込みが反映されるまで数フレームrequestAnimationFrameで再試行する
    useLayoutEffect(() => {
        const el = scrollRef.current
        if (!el) return
        const saved = scrollPositionRef.current
        if (saved <= 0) return
        let raf = 0
        let attempts = 0
        const restore = () => {
            el.scrollTop = saved
            if (el.scrollTop !== saved && attempts++ < 10) {
                raf = requestAnimationFrame(restore)
            }
        }
        restore()
        return () => cancelAnimationFrame(raf)
    }, [])

    useImperativeHandle(props.ref, () => ({
        scrollToTop: () => {
            if (isMobile) {
                scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' })
            } else {
                window.scrollTo({ top: 0, behavior: 'smooth' })
            }
        }
    }))

    /** Pull to Refreshのリフレッシュ処理 */
    const onRefresh = useCallback(async () => {
        if (!reader.current) return
        console.log('Pull to refresh: reloading timeline')
        setNewArrivals([])
        setIsFetching(true)
        try {
            await reader.current.reload()
            if (snapshotRef.current && reader.current.headLoaded) {
                await swapToLive(reader.current)
                return
            }
            await new Promise((resolve) => setTimeout(resolve, 500))
        } finally {
            setIsFetching(false)
        }
    }, [reader, swapToLive])

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
    const itemUpdated = useCallback(
        (href: string) => {
            reader.current?.updateItem(href)
        },
        [reader]
    )

    /** 新着バッジクリック時の処理 */
    const handleNewArrivalClick = useCallback(() => {
        setNewArrivals([])
        if (isMobile) {
            scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' })
        } else {
            window.scrollTo({ top: 0, behavior: 'smooth' })
        }
        onRefresh()
    }, [isMobile, onRefresh])

    useEffect(() => {
        const el = scrollRef.current
        if (!el) return
        if (!initialLoaded) return

        // モバイルはタイムライン自身、デスクトップはウィンドウがスクロールする
        const onWindow = !isMobile
        const readMetrics = () => {
            if (onWindow) {
                const scrollTop = window.scrollY
                return {
                    scrollTop,
                    distanceToEnd: document.documentElement.scrollHeight - scrollTop - window.innerHeight
                }
            }
            return {
                scrollTop: el.scrollTop,
                distanceToEnd: el.scrollHeight - el.scrollTop - el.clientHeight
            }
        }

        const handleScroll = () => {
            const { scrollTop, distanceToEnd } = readMetrics()
            scrollPositionRef.current = scrollTop

            // haltUpdate制御：スクロールが閾値を超えたら自動更新を停止
            if (reader.current) {
                reader.current.haltUpdate = scrollTop > SCROLL_HALT_THRESHOLD || newArrivalsRef.current.length > 0
            }

            if (distanceToEnd < 500) {
                if (loadingRef.current) return
                if (!hasMoreDataRef.current) return
                if (!reader.current) return

                console.log('Reading more...')

                loadingRef.current = true
                setLoading(true)
                reader.current
                    ?.readMore(8)
                    .then((hasMore) => {
                        readAheadRef.current = reader.current?.body.slice() ?? []
                        setHasMoreData(hasMore)
                    })
                    .catch((e) => {
                        console.error('Failed to read more', e)
                        console.log(reader.current?.body[reader.current.body.length - 1])
                    })
                    .finally(() => {
                        loadingRef.current = false
                        setLoading(false)
                        console.log('Finished reading more')
                    })
            }
        }

        const target: HTMLElement | Window = onWindow ? window : el
        target.addEventListener('scroll', handleScroll, { passive: true })
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
            target.removeEventListener('scroll', handleScroll)
            clearTimeout(fill)
        }
    }, [isMobile, scrollRef, reader, initialLoaded, loading, snapshot])

    const maxDisplayAvatars = 4
    const displayedArrivals = newArrivals.slice(0, maxDisplayAvatars)
    const extraCount = newArrivals.length - maxDisplayAvatars

    return (
        <PullToRefresh positionRef={scrollPositionRef} isFetching={isFetching} onRefresh={onRefresh}>
            <div
                style={{
                    position: 'relative',
                    display: 'flex',
                    flexDirection: 'column',
                    // デスクトップは中身の高さでページが伸びる。flex基準0やoverflow:hiddenだと追記が画面の外にクリップされる
                    ...(isMobile
                        ? { flex: 1, minHeight: 0, overflow: 'hidden' as const }
                        : { overflow: 'visible' as const })
                }}
            >
                {/* 新着バッジ */}
                <div
                    style={{
                        position: 'absolute',
                        top: '8px',
                        left: 0,
                        right: 0,
                        display: 'flex',
                        justifyContent: 'center',
                        zIndex: 10,
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

                <div
                    style={{
                        display: 'flex',
                        flexDirection: 'column',
                        flex: isMobile ? 1 : '0 0 auto',
                        minHeight: isMobile ? 0 : undefined,
                        gap: '8px',
                        padding: '8px 0',
                        // デスクトップでhiddenにするとvisibleがautoに化けてスクロールコンテナになり、
                        // overscrollBehaviorYがwindowへのホイールスクロールの伝播を止めてしまう
                        overflowX: isMobile ? 'hidden' : 'clip',
                        overflowY: isMobile ? 'auto' : 'visible',
                        // モバイルはカラム内スクロールなので、バーが出ても内容幅が変わらないよう先に確保する。
                        // デスクトップは親のViewがスクロールする。ここをスクロールコンテナにするとホイールが窓まで届かない
                        scrollbarGutter: isMobile ? 'stable' : undefined,
                        // 末尾への追記でブラウザがスクロール位置を補正し、表示が小刻みに震えるのを止める
                        overflowAnchor: 'none',
                        overscrollBehaviorY: 'none'
                    }}
                    ref={scrollRef}
                >
                    {props.headElement}
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
                            {(reader.current?.body.length ? reader.current.body : (seededItems ?? [])).map((item) => (
                                <Cell key={item.href} item={item} lastUpdate={item.lastUpdate?.getTime() ?? 0} />
                            ))}
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
                        // content-visibilityは画面外の高さを仮の値に潰し、追い読みのたびに
                        // スクロール位置が引き戻されて小刻みに震える
                        overflowAnchor: 'none'
                    }}
                >
                    <Suspense key={item.href} fallback={<MessageSkeleton />}>
                        <MessageContainer uri={item.href} source={item.source} content={item.content} />
                    </Suspense>
                </div>
            </ErrorBoundary>
            <Divider inset />
        </>
    )
})
Cell.displayName = 'RealtimeTimelineCell'
