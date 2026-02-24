import { Fragment, useEffect, useImperativeHandle, useRef } from 'react'
import { ScrollViewProps } from '../types/ScrollView'
import { useClient } from '../contexts/Client'
import { useRefWithUpdate } from '../hooks/useRefWithUpdate'
import { QueryTimelineReader } from '@concrnt/client'
import { MessageContainer } from './message'
import { Divider } from '@concrnt/ui'

interface Props extends ScrollViewProps {
    prefix: string
    query?: any
    batchSize?: number
}

export const QueryTimeline = (props: Props) => {
    const { client } = useClient()

    const [reader, update] = useRefWithUpdate<QueryTimelineReader | undefined>(undefined)

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
            return t
        })
        return () => {
            isCancelled = true
        }
    }, [client, reader, props.prefix, update])

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
                padding: '8px 0',
                overflowX: 'hidden',
                overflowY: 'auto'
            }}
            ref={scrollRef}
        >
            {reader.current?.body.map((item) => (
                <Fragment key={item.href}>
                    <div style={{ padding: '0 8px' }}>
                        <MessageContainer uri={item.href} source={item.source} />
                    </div>
                    <Divider />
                </Fragment>
            ))}
        </div>
    )
}
