import { Fragment, Suspense, useEffect, useState } from 'react'
import { useClient } from '../contexts/Client'
import { useRefWithUpdate } from '../hooks/useRefWithUpdate'
import { TimelineReader } from '@concrnt/client'
import { MessageContainer } from './message'
import { Divider, Text } from '@concrnt/ui'
import { ErrorBoundary, type FallbackProps } from 'react-error-boundary'

interface Props {
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

    return (
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
