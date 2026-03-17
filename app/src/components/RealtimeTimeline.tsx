import { Fragment, Suspense, useEffect, useImperativeHandle, useRef, useState } from 'react'
import { ScrollViewProps } from '../types/ScrollView'
import { useClient } from '../contexts/Client'
import { useRefWithUpdate } from '../hooks/useRefWithUpdate'
import { TimelineReader } from '@concrnt/client'
import { MessageContainer } from './message'
import { Divider, Text } from '@concrnt/ui'
import { ErrorBoundary, FallbackProps } from 'react-error-boundary'

interface Props extends ScrollViewProps {
    timelines: string[]
}

export const RealtimeTimeline = (props: Props) => {
    const { client } = useClient()

    // eslint-disable-next-line prefer-const
    let [loading, setLoading] = useState(true)
    const [reader, update] = useRefWithUpdate<TimelineReader | undefined>(undefined)

    useEffect(() => {
        console.log('Initializing timeline reader for timelines:', props.timelines)
        let isCancelled = false
        const request = async () => {
            if (!client) return

            return client.newTimelineReader().then((t) => {
                if (isCancelled) return
                t.onUpdate = () => {
                    update()
                }

                reader.current = t
                t.listen(props.timelines).finally(() => {
                    // eslint-disable-next-line react-hooks/immutability
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

    useEffect(() => {
        const el = scrollRef.current
        if (!el) return

        const handleScroll = () => {
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
        <div
            style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                padding: '8px 0',
                overflowX: 'hidden',
                overflowY: 'auto'
            }}
            ref={scrollRef}
        >
            {reader.current?.body.map((item) => (
                <Fragment key={item.timestamp.getTime() ?? item.href}>
                    <ErrorBoundary FallbackComponent={renderError}>
                        <Suspense fallback={<Text>Loading...</Text>}>
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
