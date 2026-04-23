import { ReactNode, use } from 'react'

import { useClient } from '../../contexts/Client'
import { Text } from '@concrnt/ui'
import { Schemas } from '@concrnt/worldlib'
import { MarkdownMessage } from './MarkdownMessage'
import { MediaMessage } from './MediaMessage'
import { ReplyMessage } from './ReplyMessage'
import { RerouteMessage } from './RerouteMessage'
import { LikeAssociation } from './LikeAssociation'
import { ReplyAssociation } from './ReplyAssociation'
import { RerouteAssociation } from './RerouteAssociation'
import { LegacyNoteMessage } from './legacy/note'
import { OnelineMessage } from './OnelineMessage'

interface Props {
    uri?: string
    source?: string
    lastUpdated?: number
    content?: string
    oneline?: boolean
}

export const MessageContainer = (props: Props): ReactNode | null => {
    const { client } = useClient()

    const sourceDomain = props.source ? new URL(props.source).hostname : undefined
    const message = props.content ? JSON.parse(props.content) : use(client!.getMessage<any>(props.uri!, sourceDomain))

    if (!message) return <div>Message not found</div>

    if (props.oneline) {
        return <OnelineMessage message={message} />
    }

    switch (message.schema) {
        case Schemas.markdownMessage:
        case Schemas.gfmMessage:
            return <MarkdownMessage message={message} />
        case Schemas.mediaMessage:
            return <MediaMessage message={message} />
        case Schemas.replyMessage:
            return <ReplyMessage message={message} />
        case Schemas.rerouteMessage:
            return <RerouteMessage message={message} />
        case Schemas.likeAssociation:
            return <LikeAssociation message={message} />
        case Schemas.replyAssociation:
            return <ReplyAssociation message={message} />
        case Schemas.rerouteAssociation:
            return <RerouteAssociation message={message} />
        case 'https://raw.githubusercontent.com/totegamma/concurrent-schemas/master/messages/note/0.0.1.json':
            return <LegacyNoteMessage message={message} />
        default:
            return (
                <div
                    style={{
                        overflow: 'hidden'
                    }}
                >
                    <Text>Unsupported message schema: {message.schema}</Text>
                    <pre
                        style={{
                            overflowX: 'auto'
                        }}
                    >
                        {JSON.stringify(message, null, 2)}
                    </pre>
                </div>
            )
    }
}
