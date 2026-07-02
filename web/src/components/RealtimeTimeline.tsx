import {
    memo,
    ReactNode,
    startTransition,
    Suspense,
    useCallback,
    useEffect,
    useImperativeHandle,
    useRef,
    useState
} from 'react'
import { ScrollViewProps } from '../types/ScrollView'
import { useClient } from '../contexts/Client'
import { useRefWithUpdate } from '../hooks/useRefWithUpdate'
import { TimelineItemWithUpdate, TimelineReader } from '@concrnt/client'
import { MessageContainer } from './message'
import { Text, Avatar, CssVar, Divider } from '@concrnt/ui'
import { ErrorBoundary } from 'react-error-boundary'
import { PullToRefresh } from './PullToRefresh'
import { MessageSkeleton } from './message/MessageSkeleton'
import { RenderError } from './message/RenderError'
import { Loading } from './message/Loading'
import { MdArrowUpward } from 'react-icons/md'
import { usePreference } from '../contexts/Preference'

interface NewArrivalIcon {
    id: string
    author: string
    src: string
}

interface Props extends ScrollViewProps {
    timelines: string[]
    headElement?: ReactNode
}

const SCROLL_HALT_THRESHOLD = 100

export const RealtimeTimeline = (props: Props) => {
    const { client } = useClient()

    const loadingRef = useRef(true)
    const [loading, setLoading] = useState(true)
    const [reader, update] = useRefWithUpdate<TimelineReader | undefined>(undefined)

    const [isFetching, setIsFetching] = useState(false)

    /** スクロール位置の追跡。PullToRefreshが先頭判定に使う */
    const scrollPositionRef = useRef<number>(0)

    const [hasMoreData, setHasMoreData] = useState<boolean>(false)
    const [initialLoaded, setInitialLoaded] = useState(false)

    /** 新着バッジ用ステート */
    const [newArrivals, setNewArrivals] = useState<NewArrivalIcon[]>([])
    const newArrivalsRef = useRef<NewArrivalIcon[]>([])

    // refとstateを同期
    useEffect(() => {
        newArrivalsRef.current = newArrivals
    }, [newArrivals])

    useEffect(() => {
        console.log('Initializing timeline reader for timelines:', props.timelines)
        let isCancelled = false
        setInitialLoaded(false)
        setNewArrivals([])
        const request = async () => {
            if (!client) return

            return client.newTimelineReader().then((t) => {
                if (isCancelled) return
                t.haltUpdate = false
                t.onUpdate = () => {
                    startTransition(() => {
                        update()
                    })
                }

                t.onNewItem = (item) => {
                    if (isCancelled) return
                    if (!t.haltUpdate) return
                    if (!item.href) return

                    client.getMessage(item.href).then((msg) => {
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
                t.listen(props.timelines)
                    .then((hasMoreData) => {
                        setHasMoreData(hasMoreData)
                    })
                    .finally(() => {
                        loadingRef.current = false
                        setLoading(false)
                        setInitialLoaded(true)
                    })
                return t
            })
        }
        const mt = request()
        return () => {
            isCancelled = true
            mt.then((t) => {
                t?.dispose()
            })
        }
    }, [client, reader, props.timelines, update])

    const scrollRef = useRef<HTMLDivElement>(null)

    useImperativeHandle(props.ref, () => ({
        scrollToTop: () => {
            if (scrollRef.current) {
                scrollRef.current.scrollTo({ top: 0, behavior: 'smooth' })
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
            await new Promise((resolve) => setTimeout(resolve, 500))
        } finally {
            setIsFetching(false)
        }
    }, [reader])

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
            if (reader.current) {
                reader.current.haltUpdate = el.scrollTop > SCROLL_HALT_THRESHOLD || newArrivalsRef.current.length > 0
            }

            if (el.scrollHeight - el.scrollTop - el.clientHeight < 500) {
                if (loadingRef.current) return
                if (!hasMoreData) return
                if (!reader.current) return

                console.log('Reading more...')

                loadingRef.current = true
                setLoading(true)
                reader.current
                    ?.readMore(8)
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
    }, [scrollRef, reader, hasMoreData, initialLoaded])

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
                        gap: '8px',
                        padding: '8px 0',
                        overflowX: 'hidden',
                        overflowY: 'auto',
                        overscrollBehaviorY: 'none'
                    }}
                    ref={scrollRef}
                >
                    {props.headElement}
                    {!initialLoaded &&
                        Array.from({ length: 10 }).map((_, i) => (
                            <div key={i} style={{ padding: `0 ${CssVar.space(2)}` }}>
                                <MessageSkeleton />
                            </div>
                        ))}
                    {reader.current?.body.map((item) => (
                        <Cell key={item.href} item={item} lastUpdate={item.lastUpdate?.getTime() ?? 0} />
                    ))}
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
    const [devmode] = usePreference('developerMode')

    return (
        <>
            <ErrorBoundary FallbackComponent={RenderError}>
                <div
                    style={{
                        padding: `0 ${CssVar.space(2)}`,
                        contentVisibility: 'auto'
                        // containIntrinsicSize: 'auto 300px'
                    }}
                >
                    <Suspense key={item.href} fallback={<MessageSkeleton />}>
                        <MessageContainer uri={item.href} source={item.source} content={item.content} />
                    </Suspense>
                </div>
            </ErrorBoundary>
            {devmode && <Text variant="caption">{item.href}</Text>}
            <Divider />
        </>
    )
})
Cell.displayName = 'RealtimeTimelineCell'
