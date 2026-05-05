import { Message, Schemas } from '@concrnt/worldlib'
import { TimelineTag } from '../TimelineTag'
import { useStack } from '../../layouts/Stack'
import { TimelineView } from '../../views/Timeline'

interface Props {
    message: Message<any>
}

export const PostedTimelines = (props: Props) => {
    const { push } = useStack()

    return (
        <>
            {props.message.distributes?.map((uri) => (
                <TimelineTag
                    key={uri}
                    uri={uri}
                    schemaFilter={Schemas.communityTimeline}
                    style={{
                        fontSize: '0.75rem'
                    }}
                    onClick={(e) => {
                        e.stopPropagation()
                        push(<TimelineView uri={uri} />)
                    }}
                />
            ))}
        </>
    )
}
