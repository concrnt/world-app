import { ReactNode, Suspense, use, useMemo } from 'react'

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
import { ApObject } from '../../utils/activitypub'
import { ActivitypubNote } from './ActivitypubNote'

interface Props {
    uri?: string
    source?: string
    lastUpdated?: number
    content?: string
    oneline?: boolean
}

export const MessageContainer = (props: Props): ReactNode | null => {
    if (!props.uri) return <ConcrntMessage {...props} />

    if (props.uri.startsWith('cckv://') || props.uri.startsWith('ccfs://')) {
        return <ConcrntMessage {...props} />
    }

    if (props.uri.startsWith('activity://')) {
        return <ActivityMessage uri={props.uri} />
    }

    return (
        <div
            style={{
                overflow: 'hidden'
            }}
        >
            <Text>Unsupported message URI: {props.uri}</Text>
        </div>
    )
}

const ActivityMessage = (props: { uri: string }) => {
    const { client } = useClient()
    const notePromise = useMemo(() => {
        return client.api
            .fetchWithCredential<ApObject>(client.server.domain, `/ap/api/resolve?uri=${encodeURIComponent(props.uri)}`)
            .then(async (res) => new ApObject(res))
    }, [props.uri, client])

    return (
        <Suspense fallback={<div>Loading...</div>}>
            <ActivitypubNote notePromise={notePromise} />
        </Suspense>
    )
}

const ConcrntMessage = (props: Props) => {
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
