import {
    Fragment,
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
import { TimelineReader } from '@concrnt/client'
import { MessageContainer } from './message'
import { CssVar, Divider } from '@concrnt/ui'
import { ErrorBoundary } from 'react-error-boundary'
import { PullToRefresh } from './PullToRefresh'
import { MessageSkeleton } from './message/MessageSkeleton'
import { RenderError } from './message/RenderError'
import { Loading } from './message/Loading'

interface Props extends ScrollViewProps {
    timelines: string[]
}

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

    useEffect(() => {
        console.log('Initializing timeline reader for timelines:', props.timelines)
        let isCancelled = false
        setInitialLoaded(false)
        const request = async () => {
            if (!client) return

            return client.newTimelineReader().then((t) => {
                if (isCancelled) return
                t.onUpdate = () => {
                    startTransition(() => {
                        update()
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
        setIsFetching(true)
        try {
            await reader.current.reload()
            // リロード完了後に少し待機して、ユーザーにフィードバックを見せる
            await new Promise((resolve) => setTimeout(resolve, 500))
        } finally {
            setIsFetching(false)
        }
    }, [reader])

    useEffect(() => {
        const el = scrollRef.current
        if (!el) return
        if (!initialLoaded) return

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

    return (
        <PullToRefresh positionRef={scrollPositionRef} isFetching={isFetching} onRefresh={onRefresh}>
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
                {!initialLoaded &&
                    Array.from({ length: 10 }).map((_, i) => (
                        <div key={i} style={{ padding: `0 ${CssVar.space(2)}` }}>
                            <MessageSkeleton />
                        </div>
                    ))}
                {reader.current?.body.map((item) => (
                    <Fragment key={item.timestamp.getTime() ?? item.href}>
                        <ErrorBoundary FallbackComponent={RenderError}>
                            <div
                                style={{
                                    padding: `0 ${CssVar.space(2)}`,
                                    contentVisibility: 'auto'
                                }}
                            >
                                <Suspense key={item.timestamp.getTime() ?? item.href} fallback={<MessageSkeleton />}>
                                    <MessageContainer
                                        uri={item.href}
                                        source={item.source}
                                        lastUpdated={item.lastUpdate?.getTime() ?? 0}
                                        content={item.content}
                                    />
                                </Suspense>
                            </div>
                        </ErrorBoundary>
                        <Divider />
                    </Fragment>
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
        </PullToRefresh>
    )
}
