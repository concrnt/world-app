import { Fragment, Suspense, useEffect, useImperativeHandle, useRef } from 'react'
import { ScrollViewProps } from '../types/ScrollView'
import { useClient } from '../contexts/Client'
import { useRefWithUpdate } from '../hooks/useRefWithUpdate'
import { TimelineReader } from '@concrnt/client'
import { MessageContainer } from './message'
import { Divider } from '../ui/Divider'

interface Props extends ScrollViewProps {
    timelines: string[]
}

export const RealtimeTimeline = (props: Props) => {
    const { client } = useClient()

    const [reader, update] = useRefWithUpdate<TimelineReader | undefined>(undefined)

    useEffect(() => {
        let isCancelled = false
        const request = async () => {
            if (!client) return

            return client.newTimelineReader().then((t) => {
                if (isCancelled) return
                t.onUpdate = () => {
                    update()
                }

                reader.current = t
                t.listen(props.timelines)
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

    return (
        <div
            style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                overflowY: 'auto'
            }}
            ref={scrollRef}
        >
            {reader.current?.body.map((item) => (
                <Fragment key={item.href}>
                    <div style={{ padding: '0 8px' }}>
                        <Suspense fallback={<div>Loading...</div>}>
                            <MessageContainer uri={item.href} source={item.source} />
                        </Suspense>
                    </div>
                    <Divider />
                </Fragment>
            ))}
        </div>
    )
}
