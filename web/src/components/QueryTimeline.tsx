import { Fragment, Suspense, useEffect, useRef, useState } from 'react'
import { CssVar, Divider, Text } from '@concrnt/ui'
import { ErrorBoundary } from 'react-error-boundary'
import { MessageContainer } from './message'
import { useClient } from '../contexts/Client'

interface Props {
    prefix: string
    query?: {
        schema?: string
    }
    emptyLabel?: string
}

interface QueryItem {
    href: string
    timestamp: Date
    source?: string
}

export const QueryTimeline = (props: Props) => {
    const { client } = useClient()
    const [items, setItems] = useState<QueryItem[]>([])
    const [loading, setLoading] = useState(true)
    const [hasMore, setHasMore] = useState(false)
    const loadingMoreRef = useRef(false)
    const scrollRef = useRef<HTMLDivElement | null>(null)

    useEffect(() => {
        if (!client) return
        let isCancelled = false
        setLoading(true)
        setItems([])
        setHasMore(false)

        void client
            .api.query({
                prefix: props.prefix,
                schema: props.query?.schema,
                limit: 20
            })
            .then((records) => {
                if (isCancelled) return
                const nextItems = records.map((record) => {
                    const document = JSON.parse(record.document) as { createdAt: string }
                    return {
                        href: record.cckv,
                        timestamp: new Date(document.createdAt),
                        source: props.prefix
                    }
                })
                setItems(nextItems)
                setHasMore(records.length >= 20)
            })
            .finally(() => {
                if (isCancelled) return
                setLoading(false)
            })

        return () => {
            isCancelled = true
        }
    }, [client, props.prefix, props.query?.schema])

    useEffect(() => {
        const element = scrollRef.current
        if (!element || !client) return

        const handleScroll = () => {
            if (!hasMore || loadingMoreRef.current) return
            if (element.scrollHeight - element.scrollTop - element.clientHeight > 500) return
            if (items.length === 0) return

            loadingMoreRef.current = true
            const last = items[items.length - 1]

            void client.api
                .query({
                    prefix: props.prefix,
                    schema: props.query?.schema,
                    until: last.timestamp.toISOString(),
                    limit: 20
                })
                .then((records) => {
                    const nextItems = records.map((record) => {
                        const document = JSON.parse(record.document) as { createdAt: string }
                        return {
                            href: record.cckv,
                            timestamp: new Date(document.createdAt),
                            source: props.prefix
                        }
                    })
                    const deduped = nextItems.filter((nextItem) => !items.some((item) => item.href === nextItem.href))
                    setItems((current) => current.concat(deduped))
                    setHasMore(records.length >= 20)
                })
                .finally(() => {
                    loadingMoreRef.current = false
                })
        }

        element.addEventListener('scroll', handleScroll)
        return () => element.removeEventListener('scroll', handleScroll)
    }, [client, hasMore, items, props.prefix, props.query?.schema])

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
            {loading && <Status label="Loading timeline..." />}
            {!loading && items.length === 0 && <Status label={props.emptyLabel ?? '投稿がまだありません。'} />}
            {items.map((item) => (
                <Fragment key={item.href}>
                    <ErrorBoundary fallback={<Status label="Failed to render message." compact={true} />}>
                        <Suspense fallback={<Status label="Loading message..." compact={true} />}>
                            <div
                                style={{
                                    padding: `${CssVar.space(3)} ${CssVar.space(3)} 0`
                                }}
                            >
                                <MessageContainer uri={item.href} source={item.source} />
                            </div>
                        </Suspense>
                    </ErrorBoundary>
                    <Divider />
                </Fragment>
            ))}
        </div>
    )
}

const Status = (props: { label: string; compact?: boolean }) => {
    return (
        <div
            style={{
                padding: props.compact ? CssVar.space(3) : CssVar.space(5),
                minHeight: props.compact ? undefined : '160px',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                textAlign: 'center'
            }}
        >
            <Text style={{ opacity: 0.72 }}>{props.label}</Text>
        </div>
    )
}
