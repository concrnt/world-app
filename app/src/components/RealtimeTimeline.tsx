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
import { Divider, Text } from '@concrnt/ui'
import { ErrorBoundary, FallbackProps } from 'react-error-boundary'
import { PullToRefresh } from './PullToRefresh'

interface Props extends ScrollViewProps {
    timelines: string[]
}

export const RealtimeTimeline = (props: Props) => {
    const { client } = useClient()

    // eslint-disable-next-line prefer-const
    let [loading, setLoading] = useState(true)
    const [reader, update] = useRefWithUpdate<TimelineReader | undefined>(undefined)

    const [isFetching, setIsFetching] = useState(false)

    /** スクロール位置の追跡。PullToRefreshが先頭判定に使う */
    const scrollPositionRef = useRef<number>(0)

    useEffect(() => {
        console.log('Initializing timeline reader for timelines:', props.timelines)
        let isCancelled = false
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
                t.listen(props.timelines).finally(() => {
                    setLoading((loading = false))
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

        const handleScroll = () => {
            // PullToRefresh用にスクロール位置を記録
            scrollPositionRef.current = el.scrollTop

            if (el.scrollHeight - el.scrollTop - el.clientHeight < 500) {
                if (loading) return
                if (!reader.current) return

                console.log('Reading more...')

                setLoading((loading = true))
                reader.current
                    ?.readMore(8)
                    .finally(() => {
                        setLoading((loading = false))
                        console.log('Finished reading more')
                    })
                    .catch((e) => {
                        console.error('Failed to read more', e)
                        console.log(reader.current?.body[reader.current.body.length - 1])
                    })
            }
        }

        el.addEventListener('scroll', handleScroll)
        return () => {
            el.removeEventListener('scroll', handleScroll)
        }
    }, [scrollRef])

    return (
        <PullToRefresh scrollPositionRef={scrollPositionRef} isFetching={isFetching} onRefresh={onRefresh}>
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
                {reader.current?.body.map((item) => (
                    <Fragment key={item.timestamp.getTime() ?? item.href}>
                        <ErrorBoundary FallbackComponent={renderError}>
                            <Suspense key={item.timestamp.getTime() ?? item.href} fallback={<Text>Loading...</Text>}>
                                <div
                                    style={{
                                        padding: '0 8px',
                                        contentVisibility: 'auto'
                                    }}
                                >
                                    <MessageContainer
                                        uri={item.href}
                                        source={item.source}
                                        lastUpdated={item.lastUpdate?.getTime() ?? 0}
                                        content={item.content}
                                    />
                                </div>
                            </Suspense>
                        </ErrorBoundary>
                        <Divider />
                    </Fragment>
                ))}
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
                    Loading...
                </div>
            </div>
        </PullToRefresh>
    )
}

const renderError = ({ error }: FallbackProps) => {
    return (
        <div>
            {(error as any)?.message}
            <pre>{(error as any)?.stack}</pre>
        </div>
    )
}
