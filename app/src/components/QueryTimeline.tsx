import {
    createContext,
    memo,
    ReactNode,
    Suspense,
    useCallback,
    useContext,
    useEffect,
    useImperativeHandle,
    useReducer,
    useRef,
    useState
} from 'react'
import { Client } from '@concrnt/worldlib'
import { ScrollViewProps } from '../types/ScrollView'
import { useClient } from '../contexts/Client'
import { useDomainStatus } from '../hooks/useDomainStatus'
import { ChunklineItem, QueryTimelineReader, ServerOfflineError } from '@concrnt/client'
import { MessageContainer } from './message'
import { CssVar, Divider } from '@concrnt/ui'
import { ErrorBoundary } from 'react-error-boundary'
import { RenderError } from './message/RenderError'
import { MessageSkeleton } from './message/MessageSkeleton'
import { Loading } from './message/Loading'
import { PullToRefresh } from './PullToRefresh'

interface Props extends ScrollViewProps {
    prefix: string
    query?: any
    batchSize?: number
    header?: ReactNode
}

interface QueryTimelineContextState {
    update: (href: string) => void
    remove?: (href: string) => void
}

export const QueryTimelineContext = createContext<QueryTimelineContextState>({
    update: (_href: string) => {},
    remove: (_href: string) => {}
})

export const useQueryTimelineContext = () => {
    return useContext(QueryTimelineContext)
}

// 画面が埋まっていないときの追い読み判定の猶予(ms)。初期値から判定ごとに倍増し上限で頭打ち
const FILL_DELAY_MIN = 100
const FILL_DELAY_MAX = 1000

export const QueryTimeline = (props: Props) => {
    // 取得対象が変わったら中身ごと作り直す(呼び出し側がquery参照を作り直しても、内容が同じなら維持)
    return (
        <QueryTimelineInner
            key={props.prefix + '|' + JSON.stringify(props.query ?? {}) + '|' + (props.batchSize ?? '')}
            {...props}
        />
    )
}

const QueryTimelineInner = (props: Props) => {
    const { client } = useClient()
    // このインスタンスの取得対象は固定(変わったら外側でkeyごと作り直される)
    const [target] = useState(() => ({
        prefix: props.prefix,
        query: props.query ?? {},
        batchSize: props.batchSize ?? 16
    }))

    const loadingRef = useRef(true)
    const fillDelayRef = useRef(FILL_DELAY_MIN)
    const scrollPositionRef = useRef<number>(0)
    // 表示はreaderRef.current.bodyを直接読み、readerの更新はforceUpdateで反映する
    const readerRef = useRef<QueryTimelineReader | undefined>(undefined)
    // readerをどのClientで初期化したか。Activityのhidden→visible復帰やStrictModeでは
    // refを残したままeffectだけが再実行されるので、同じClientなら何もしない
    const initializedRef = useRef<Client | undefined>(undefined)
    const [, forceUpdate] = useReducer((x: number) => x + 1, 0)
    const [loading, setLoading] = useState(true)
    const [hasMoreData, setHasMoreData] = useState<boolean>(false)
    // PullToRefresh のインジケータ表示制御用
    const [isFetching, setIsFetching] = useState(false)
    // 初期取得がオフラインで失敗したホスト。そのホストの復帰(onlineSince更新)で取り直す
    const [failedHost, setFailedHost] = useState<string | undefined>(undefined)
    const failedStatus = useDomainStatus(failedHost)

    const load = useCallback(
        (t: QueryTimelineReader) => {
            loadingRef.current = true
            t.init(target.prefix, target.query, target.batchSize)
                .then((hasMoreData) => {
                    if (readerRef.current !== t) return
                    setHasMoreData(hasMoreData)
                    setFailedHost(undefined)
                })
                .catch((err) => {
                    console.error('Failed to initialize query timeline:', err)
                    if (readerRef.current !== t) return
                    if (err instanceof ServerOfflineError) setFailedHost(err.host)
                })
                .finally(() => {
                    if (readerRef.current !== t) return
                    loadingRef.current = false
                    setLoading(false)
                })
        },
        [target]
    )

    useEffect(() => {
        if (initializedRef.current === client) return
        const t = client.newQueryTimelineReader()
        // Client差し替え: 取り直しが届くまで表示中の内容を残す
        t.body = readerRef.current?.body ?? []
        t.onUpdate = forceUpdate
        readerRef.current = t
        initializedRef.current = client
        load(t)
    }, [client, load])

    // 初期取得が失敗したホストの復帰で取り直す
    useEffect(() => {
        if (!failedHost || !failedStatus.online || !readerRef.current) return
        load(readerRef.current)
    }, [failedHost, failedStatus.online, failedStatus.onlineSince, load])

    const scrollRef = useRef<HTMLDivElement>(null)

    useImperativeHandle(props.ref, () => ({
        scrollToTop: () => {
            if (scrollRef.current) {
                scrollRef.current.scrollTo({ top: 0, behavior: 'smooth' })
            }
        }
    }))

    // PullToRefresh のリロード処理
    const onRefresh = useCallback(async () => {
        if (!readerRef.current) return
        setIsFetching(true)
        try {
            const hasMore = await readerRef.current.reload()
            setHasMoreData(hasMore)
            // ユーザーにリフレッシュのフィードバックを見せるための短い待機
            await new Promise((resolve) => setTimeout(resolve, 500))
        } finally {
            setIsFetching(false)
        }
    }, [])

    const itemUpdated = useCallback((href: string) => {
        readerRef.current?.updateItem(href)
    }, [])

    const itemRemoved = useCallback((href: string) => {
        readerRef.current?.removeItem(href)
    }, [])

    useEffect(() => {
        const el = scrollRef.current
        if (!el) return

        const handleScroll = () => {
            // PullToRefresh用にスクロール位置を記録
            scrollPositionRef.current = el.scrollTop

            if (el.scrollHeight - el.scrollTop - el.clientHeight < 500) {
                if (loadingRef.current) return
                if (!hasMoreData) return
                if (!readerRef.current) return

                loadingRef.current = true
                setLoading(true)
                readerRef.current
                    ?.readMore()
                    .then((hasMore) => {
                        setHasMoreData(hasMore)
                    })
                    .catch((e) => {
                        console.error('Failed to read more', e)
                    })
                    .finally(() => {
                        loadingRef.current = false
                        setLoading(false)
                    })
            }
        }

        el.addEventListener('scroll', handleScroll)
        // コンテンツがコンテナを満たしていないとscrollイベントが発生せず次ページが永遠に読まれないため、
        // 読み込みが落ち着いたら一度だけ手動で判定する(不足していればreadMore→loadingが戻って再判定)。
        // 猶予は短く始めて判定でreadMoreが走るたびに倍にし(上限あり)、埋まった/読み切ったら初期値に戻す
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
    }, [hasMoreData, loading])

    return (
        <PullToRefresh positionRef={scrollPositionRef} isFetching={isFetching} onRefresh={onRefresh}>
            <div
                style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px',
                    overflowX: 'hidden',
                    overflowY: 'auto',
                    overscrollBehaviorY: 'none',
                    touchAction: 'pan-y'
                }}
                ref={scrollRef}
            >
                {props.header}
                <QueryTimelineContext.Provider value={{ update: itemUpdated, remove: itemRemoved }}>
                    {readerRef.current?.body.map((item) => (
                        <Cell
                            key={item.timestamp.getTime() ?? item.href}
                            item={item}
                            lastUpdate={item.lastUpdate?.getTime() ?? 0}
                        />
                    ))}
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
        </PullToRefresh>
    )
}

interface CellProps {
    item: ChunklineItem
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
                    <Suspense key={item.timestamp.getTime() ?? item.href} fallback={<MessageSkeleton />}>
                        <MessageContainer uri={item.href} source={item.source} />
                    </Suspense>
                </div>
            </ErrorBoundary>
            <Divider inset />
        </>
    )
})
Cell.displayName = 'QueryTimelineCell'
