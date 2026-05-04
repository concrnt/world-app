import { Fragment, Suspense, useEffect, useRef, useState } from 'react'
import { ErrorBoundary, type FallbackProps } from 'react-error-boundary'
import { TimelineReader } from '@concrnt/client'
import { CssVar, Divider, Text } from '@concrnt/ui'
import { useClient } from '../contexts/Client'
import { MessageContainer } from './message'

interface Props {
    timelines: string[]
}

export const RealtimeTimeline = (props: Props) => {
    const { client } = useClient()
    const loadingRef = useRef(true)
    const scrollRef = useRef<HTMLDivElement | null>(null)
    const readerRef = useRef<TimelineReader | undefined>(undefined)
    const [items, setItems] = useState<TimelineReader['body']>([])
    const [isInitialLoading, setIsInitialLoading] = useState(true)
    const [isLoadingMore, setIsLoadingMore] = useState(false)
    const [hasMoreData, setHasMoreData] = useState(false)

    useEffect(() => {
        let isCancelled = false
        setIsInitialLoading(true)
        setIsLoadingMore(false)
        setHasMoreData(false)
        setItems([])
        loadingRef.current = true

        const request = async () => {
            if (!client) return undefined

            const timelineReader = await client.newTimelineReader()
            if (isCancelled) {
                timelineReader.dispose()
                return undefined
            }

            timelineReader.onUpdate = () => {
                setItems([...timelineReader.body])
            }

            readerRef.current = timelineReader

            timelineReader
                .listen(props.timelines)
                .then((hasMore) => {
                    if (isCancelled) return
                    setItems([...timelineReader.body])
                    setHasMoreData(hasMore)
                })
                .finally(() => {
                    if (isCancelled) return
                    loadingRef.current = false
                    setIsInitialLoading(false)
                })

            return timelineReader
        }

        const pending = request()

        return () => {
            isCancelled = true
            pending.then((timelineReader) => {
                timelineReader?.dispose()
            })
        }
    }, [client, props.timelines])

    useEffect(() => {
        const element = scrollRef.current
        if (!element) return
        if (isInitialLoading) return

        const handleScroll = () => {
            if (element.scrollHeight - element.scrollTop - element.clientHeight > 500) return
            if (loadingRef.current || !hasMoreData || !readerRef.current) return

            loadingRef.current = true
            setIsLoadingMore(true)
            readerRef.current
                .readMore(8)
                .then((hasMore) => {
                    setItems([...(readerRef.current?.body ?? [])])
                    setHasMoreData(hasMore)
                })
                .finally(() => {
                    loadingRef.current = false
                    setIsLoadingMore(false)
                })
        }

        element.addEventListener('scroll', handleScroll)
        return () => {
            element.removeEventListener('scroll', handleScroll)
        }
    }, [hasMoreData, isInitialLoading])

    const isEmpty = !isInitialLoading && items.length === 0

    return (
        <div
            ref={scrollRef}
            style={{
                flex: 1,
                minHeight: 0,
                overflowY: 'auto',
                display: 'flex',
                flexDirection: 'column'
            }}
        >
            {isInitialLoading && (
                <TimelineStatus label="Loading timeline..." />
            )}

            {items.map((item) => (
                <Fragment key={item.timestamp.getTime() ?? item.href}>
                    <ErrorBoundary FallbackComponent={renderError}>
                        <Suspense fallback={<TimelineStatus label="Loading message..." compact={true} />}>
                            <div
                                style={{
                                    padding: `${CssVar.space(3)} ${CssVar.space(3)} 0`,
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

            {isEmpty && <TimelineStatus label="表示できる投稿がまだありません。" />}
            {isLoadingMore && <TimelineStatus label="過去の投稿を読み込んでいます..." compact={true} />}
            {!isInitialLoading && !hasMoreData && !isEmpty && <TimelineStatus label="タイムラインの末尾です。" compact={true} />}
        </div>
    )
}

const TimelineStatus = (props: { label: string; compact?: boolean }) => {
    return (
        <div
            style={{
                padding: props.compact ? CssVar.space(3) : CssVar.space(5),
                minHeight: props.compact ? undefined : '160px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                textAlign: 'center'
            }}
        >
            <Text
                style={{
                    opacity: 0.72
                }}
            >
                {props.label}
            </Text>
        </div>
    )
}

const renderError = ({ error }: FallbackProps) => {
    return (
        <div
            style={{
                padding: CssVar.space(3)
            }}
        >
            <Text>{error instanceof Error ? error.message : 'Failed to render message.'}</Text>
        </div>
    )
}
