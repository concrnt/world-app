import { ReactNode, use } from 'react'

import { useClient } from '../../contexts/Client'
import { Text } from '@concrnt/ui'
import { ApNoteSchema, AtprotoRecordSchema, Message, RerouteMessageSchema, Schemas } from '@concrnt/worldlib'
import { MarkdownMessage } from './MarkdownMessage'
import { GfmMessage } from './GfmMessage'
import { MfmMessage } from './MfmMessage'
import { PlaintextMessage } from './PlaintextMessage'
import { MediaMessage } from './MediaMessage'
import { ReplyMessage } from './ReplyMessage'
import { RerouteMessage } from './RerouteMessage'
import { LikeAssociation } from './LikeAssociation'
import { ReactionAssociation } from './ReactionAssociation'
import { ReplyAssociation } from './ReplyAssociation'
import { RerouteAssociation } from './RerouteAssociation'
import { FollowAck } from './FollowAck'
import { LegacyNoteMessage } from './legacy/note'
import { OnelineMessage } from './OnelineMessage'
import { ActivitypubNote } from './ActivitypubNote'
import { BlueskyRecord } from './BlueskyRecord'

interface Props {
    uri?: string
    source?: string
    content?: string
    oneline?: boolean
    forceExpanded?: boolean
    detail?: boolean
    rerouted?: Message<RerouteMessageSchema>
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
            return (
                <MarkdownMessage
                    message={message}
                    forceExpanded={props.forceExpanded}
                    detail={props.detail}
                    rerouted={props.rerouted}
                />
            )
        case Schemas.gfmMessage:
            return (
                <GfmMessage
                    message={message}
                    forceExpanded={props.forceExpanded}
                    detail={props.detail}
                    rerouted={props.rerouted}
                />
            )
        case Schemas.mfmMessage:
            return (
                <MfmMessage
                    message={message}
                    forceExpanded={props.forceExpanded}
                    detail={props.detail}
                    rerouted={props.rerouted}
                />
            )
        case Schemas.plaintextMessage:
            return (
                <PlaintextMessage
                    message={message}
                    forceExpanded={props.forceExpanded}
                    detail={props.detail}
                    rerouted={props.rerouted}
                />
            )
        case Schemas.mediaMessage:
            return (
                <MediaMessage
                    message={message}
                    forceExpanded={props.forceExpanded}
                    detail={props.detail}
                    rerouted={props.rerouted}
                />
            )
        case Schemas.replyMessage:
            return (
                <ReplyMessage
                    message={message}
                    forceExpanded={props.forceExpanded}
                    detail={props.detail}
                    rerouted={props.rerouted}
                />
            )
        case Schemas.rerouteMessage:
            return <RerouteMessage message={message} />
        case Schemas.likeAssociation:
            return <LikeAssociation message={message} />
        case Schemas.reactionAssociation:
            return <ReactionAssociation message={message} />
        case Schemas.replyAssociation:
            return <ReplyAssociation message={message} />
        case Schemas.rerouteAssociation:
            return <RerouteAssociation message={message} />
        case Schemas.followAck:
            return <FollowAck message={message} />
        case Schemas.apNote: {
            const noteMessage = message as Message<ApNoteSchema>
            return (
                <ActivitypubNote
                    actorURL={noteMessage.value.actorURL}
                    noteURL={noteMessage.value.noteURL}
                    message={message}
                    forceExpanded={props.forceExpanded}
                    detail={props.detail}
                    rerouted={props.rerouted}
                />
            )
        }
        case Schemas.atprotoRecord: {
            const recordMessage = message as Message<AtprotoRecordSchema>
            return (
                <BlueskyRecord
                    atUri={recordMessage.value.atUri}
                    message={recordMessage}
                    detail={props.detail}
                    rerouted={props.rerouted}
                />
            )
        }
        case 'https://raw.githubusercontent.com/totegamma/concurrent-schemas/master/messages/note/0.0.1.json':
            return <LegacyNoteMessage message={message} forceExpanded={props.forceExpanded} detail={props.detail} />
        default:
            return (
                <div>
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
