import { Suspense, use, useMemo } from 'react'
import { Skeleton, Text } from '@concrnt/ui'
import { useClient } from '../contexts/Client'
import { MdOutlineTag } from 'react-icons/md'
import { Timeline } from '@concrnt/worldlib'

interface Props {
    uri: string
    schemaFilter?: string
    onClick?: (e: React.MouseEvent) => void
    style?: React.CSSProperties
}

export const TimelineTag = (props: Props) => {
    const { client } = useClient()

    const timelinePromise = useMemo(() => {
        if (!client) return Promise.resolve(null)
        return client.getTimeline(props.uri)
    }, [client, props.uri])

    return (
        <Suspense fallback={<Skeleton height={props.style?.fontSize ?? '1rem'} width={'3rem'} />}>
            <Inner
                timelinePromise={timelinePromise}
                filter={props.schemaFilter}
                onClick={props.onClick}
                style={props.style}
            />
        </Suspense>
    )
}

interface InnerProps {
    timelinePromise: Promise<Timeline | null>
    filter?: string
    onClick?: (e: React.MouseEvent) => void
    style?: React.CSSProperties
}

const Inner = (props: InnerProps) => {
    const timeline = use(props.timelinePromise)

    if (!timeline) return null
    if (props.filter && timeline.schema !== props.filter) return null

    return (
        <span
            style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.25rem'
            }}
            onClick={props.onClick}
        >
            <MdOutlineTag size={16} />
            <Text style={props.style}>{timeline.shortname ?? timeline.name ?? 'no name'}</Text>
        </span>
    )
}
