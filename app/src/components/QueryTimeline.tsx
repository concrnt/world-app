import { Fragment, ReactNode, Suspense, useEffect, useImperativeHandle, useRef, useState } from 'react'
import { ScrollViewProps } from '../types/ScrollView'
import { useClient } from '../contexts/Client'
import { useRefWithUpdate } from '../hooks/useRefWithUpdate'
import { QueryTimelineReader } from '@concrnt/client'
import { MessageContainer } from './message'
import { CssVar, Divider } from '@concrnt/ui'
import { ErrorBoundary } from 'react-error-boundary'
import { RenderError } from './message/RenderError'
import { MessageSkeleton } from './message/MessageSkeleton'
import { Loading } from './message/Loading'

interface Props extends ScrollViewProps {
    prefix: string
    query?: any
    batchSize?: number
    header?: ReactNode
}

export const QueryTimeline = (props: Props) => {
    const { client } = useClient()

    const loadingRef = useRef(true)
    const scrollPositionRef = useRef<number>(0)
    const [reader, update] = useRefWithUpdate<QueryTimelineReader | undefined>(undefined)
    const [loading, setLoading] = useState(true)
    const [hasMoreData, setHasMoreData] = useState<boolean>(false)

    useEffect(() => {
        let isCancelled = false
        if (!client) return
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

    useImperativeHandle(props.ref, () => ({
        scrollToTop: () => {
            if (scrollRef.current) {
                scrollRef.current.scrollTo({ top: 0, behavior: 'smooth' })
            }
        }
    }))

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
        <div
            style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                overflowX: 'hidden',
                overflowY: 'auto'
            }}
            ref={scrollRef}
        >
            {props.header}
            {reader.current?.body.map((item) => (
                <Fragment key={item.href}>
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
    )
}
