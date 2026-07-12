import {
    createContext,
    memo,
    ReactNode,
    Suspense,
    useCallback,
    useContext,
    useEffect,
    useImperativeHandle,
    useLayoutEffect,
    useRef,
    useState
} from 'react'
import { ScrollViewProps } from '../types/ScrollView'
import { useClient } from '../contexts/Client'
import { useRefWithUpdate } from '../hooks/useRefWithUpdate'
import { ChunklineItem, QueryTimelineReader } from '@concrnt/client'
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
}

const QueryTimelineContext = createContext<QueryTimelineContextState>({
    update: (_href: string) => {}
})

export const useQueryTimelineContext = () => {
    return useContext(QueryTimelineContext)
}

export const QueryTimeline = (props: Props) => {
    const { client } = useClient()

    const loadingRef = useRef(true)
    const scrollPositionRef = useRef<number>(0)
    const [reader, update] = useRefWithUpdate<QueryTimelineReader | undefined>(undefined)
    const [loading, setLoading] = useState(true)
    const [hasMoreData, setHasMoreData] = useState<boolean>(false)
    // PullToRefresh のインジケータ表示制御用
    const [isFetching, setIsFetching] = useState(false)

    useEffect(() => {
        let isCancelled = false
        if (!client) return

        // 再アタッチパス: effectが再実行されても(query参照の作り直し等)、
        // 対象が同じなら既存readerを保持する(スクロール位置と表示内容を維持)
        const existing = reader.current
        if (
            existing &&
            existing.prefix === props.prefix &&
            JSON.stringify(existing.query ?? {}) === JSON.stringify(props.query ?? {}) &&
            existing.body.length > 0
        ) {
            existing.onUpdate = () => {
                update()
            }
            return
        }

        client.newQueryTimelineReader().then((t) => {
            if (isCancelled) return
            t.onUpdate = () => {
                update()
            }

            reader.current = t
            t.init(props.prefix, props.query, props.batchSize ?? 16)
                .then((hasMoreData) => {
                    setHasMoreData(hasMoreData)
                })
                .finally(() => {
                    loadingRef.current = false
                    setLoading(false)
                })
            return t
        })
        return () => {
            isCancelled = true
        }
    }, [client, reader, props.prefix, update, props.batchSize, props.query])

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
            if (scrollRef.current) {
                scrollRef.current.scrollTo({ top: 0, behavior: 'smooth' })
            }
        }
    }))

    // PullToRefresh のリロード処理
    const onRefresh = useCallback(async () => {
        if (!reader.current) return
        setIsFetching(true)
        try {
            const hasMore = await reader.current.reload()
            setHasMoreData(hasMore)
            // ユーザーにリフレッシュのフィードバックを見せるための短い待機
            await new Promise((resolve) => setTimeout(resolve, 500))
        } finally {
            setIsFetching(false)
        }
    }, [reader])

    const itemUpdated = useCallback(
        (href: string) => {
            console.log('Item updated:', href)
            if (!reader.current) return
            reader.current.updateItem(href)
        },
        [reader]
    )

    useEffect(() => {
        const el = scrollRef.current
        if (!el) return

        const handleScroll = () => {
            // PullToRefresh用にスクロール位置を記録
            scrollPositionRef.current = el.scrollTop

            if (el.scrollHeight - el.scrollTop - el.clientHeight < 500) {
                if (loadingRef.current) return
                if (!hasMoreData) return
                if (!reader.current) return

                console.log('Reading more...')

                loadingRef.current = true
                setLoading(true)
                reader.current
                    ?.readMore()
                    .then((hasMore) => {
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

        el.addEventListener('scroll', handleScroll)
        return () => {
            el.removeEventListener('scroll', handleScroll)
        }
    }, [scrollRef, reader, hasMoreData])

    return (
        <PullToRefresh positionRef={scrollPositionRef} isFetching={isFetching} onRefresh={onRefresh}>
            <div
                style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px',
                    overflowX: 'hidden',
                    overflowY: 'auto',
                    // iOS の慣性スクロール跳ね返りを抑制して PullToRefresh との干渉を防ぐ
                    overscrollBehaviorY: 'none'
                }}
                ref={scrollRef}
            >
                {props.header}
                <QueryTimelineContext.Provider value={{ update: itemUpdated }}>
                    {reader.current?.body.map((item) => (
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
                        contentVisibility: 'auto'
                    }}
                >
                    <Suspense key={item.timestamp.getTime() ?? item.href} fallback={<MessageSkeleton />}>
                        <MessageContainer uri={item.href} source={item.source} />
                    </Suspense>
                </div>
            </ErrorBoundary>
            <Divider />
        </>
    )
})
Cell.displayName = 'QueryTimelineCell'
