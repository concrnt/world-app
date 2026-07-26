import { Suspense, use, useMemo, type CSSProperties } from 'react'

import { MdTag } from 'react-icons/md'

import { Chip } from '@concrnt/ui'
import { semantics, Timeline } from '@concrnt/worldlib'

import { useClient } from '../contexts/Client'
import { useStack } from '../layouts/Stack'
import { TimelineView } from '../views/Timeline'

export interface TimelineChipProps {
    fqid: string // <communityID>@<domain>
    style?: CSSProperties
}

export const TimelineChip = (props: TimelineChipProps) => {
    const { client } = useClient()

    const uri = useMemo(() => {
        const [id, domain] = props.fqid.split('@')
        if (!id || !domain) return null
        return semantics.community(domain, id)
    }, [props.fqid])

    const timelinePromise = useMemo(() => {
        return uri ? client.getTimeline(uri) : Promise.resolve(null)
    }, [uri, client])

    return (
        <Suspense
            fallback={
                <Chip headElement={<MdTag size={16} />} style={props.style}>
                    {props.fqid}
                </Chip>
            }
        >
            <TimelineChipBody {...props} uri={uri} timelinePromise={timelinePromise} />
        </Suspense>
    )
}

interface BodyProps extends TimelineChipProps {
    uri: string | null
    timelinePromise: Promise<Timeline | null>
}

const TimelineChipBody = (props: BodyProps) => {
    const { push } = useStack()
    const timeline = use(props.timelinePromise)

    if (!timeline || !props.uri) {
        return (
            <Chip headElement={<MdTag size={16} />} style={props.style}>
                {props.fqid}
            </Chip>
        )
    }

    const uri = props.uri

    return (
        <Chip
            headElement={<MdTag size={16} />}
            style={props.style}
            onClick={(e) => {
                e.stopPropagation()
                push(<TimelineView uri={uri} />)
            }}
        >
            {timeline.name}
        </Chip>
    )
}
