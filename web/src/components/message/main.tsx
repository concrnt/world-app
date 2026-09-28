import { createContext, ReactNode, use, useContext } from 'react'
import { useTranslation } from 'react-i18next'

import { useClient } from '../../contexts/Client'
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
import { MentionAssociation } from './MentionAssociation'
import { FollowAck } from './FollowAck'
import { LegacyNoteMessage } from './legacy/note'
import { OnelineMessage } from './OnelineMessage'
import { ActivitypubNote } from './ActivitypubNote'
import { ActivitypubNoteOneline } from './ActivitypubNoteOneline'
import { BlueskyRecord } from './BlueskyRecord'
import { ErrorNotice } from './ErrorNotice'

interface Props {
    uri?: string
    source?: string
    hint?: string
    content?: string
    oneline?: boolean
    forceExpanded?: boolean
    detail?: boolean
    rerouted?: Message<RerouteMessageSchema>
}

// 起動直後のロード中表示専用のスナップショット(uri → 復元済みMessage)。RealtimeTimelineが
// initialTimelineを描いている間だけ提供し、該当uriがあれば通常経路(getMessage)を使わずにそれを描く。
// ネストしたMessageContainer(リプライ/リルート先)も同じContextを見るので、同梱分は0往復で描ける
export const MessageSnapshotContext = createContext<Map<string, Message<any>> | undefined>(undefined)

export const MessageContainer = (props: Props): ReactNode | null => {
    const { client } = useClient()
    const { t } = useTranslation('', { keyPrefix: 'components.renderError' })

    const sourceDomain = props.source ? new URL(props.source).hostname : undefined
    const hint = props.hint ?? sourceDomain
    const snapshot = useContext(MessageSnapshotContext)?.get(props.uri ?? '')
    const message = props.content
        ? JSON.parse(props.content)
        : (snapshot ?? use(client!.getMessage<any>(props.uri!, hint)))

    if (!message) return <div>Message not found</div>

    if (props.oneline) {
        if (message.schema === Schemas.apNote) {
            return <ActivitypubNoteOneline message={message as Message<ApNoteSchema>} />
        }
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
        case Schemas.mentionAssociation:
            return <MentionAssociation message={message} />
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
            // 未対応スキーマの生JSONは開発者向け情報なので、1行表示+iボタンのドロワーで確認できるようにする
            return (
                <div
                    style={{
                        padding: '0 8px'
                    }}
                >
                    <ErrorNotice
                        message={t('unsupportedSchema')}
                        detail={`Unsupported message schema: ${message.schema}\n` + JSON.stringify(message, null, 2)}
                    />
                </div>
            )
    }
}
