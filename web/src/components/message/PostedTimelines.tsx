import { Message, Schemas } from '@concrnt/worldlib'
import { TimelineTag } from '../TimelineTag'
import { useNavigate } from 'react-router-dom'

interface Props {
    message: Message<any>
}

export const PostedTimelines = (props: Props) => {
    const navigate = useNavigate()

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
                        navigate('/timeline/' + encodeURIComponent(uri))
                    }}
                />
            ))}
        </>
    )
}
