import { ReactNode, Suspense, use, useDeferredValue, useMemo } from 'react'
import { IsCCID, parseCCURI } from '@concrnt/client'

import { useClient } from '../../contexts/Client'
import { Text } from '@concrnt/ui'
import { Message, Schemas } from '@concrnt/worldlib'
import { MarkdownMessage } from './MarkdownMessage'
import { ReplyMessage } from './ReplyMessage'
import { RerouteMessage } from './RerouteMessage'
import { LikeAssociation } from './LikeAssociation'
import { LegacyNoteMessage } from './legacy/note'

interface Props {
    uri?: string
    source?: string
    lastUpdated?: number
    content?: string
}

export const MessageContainer = (props: Props): ReactNode | null => {
    const { client } = useClient()

    const messagePromise = useMemo(() => {
        console.log('Fetching message', props.uri, props.content)
        if (props.uri) {
            const fetchHint = async () => {
                let hint: string | undefined = undefined
                try {
                    if (props.source) {
                        const { owner } = parseCCURI(props.source)
                        if (IsCCID(owner)) {
                            const user = await client?.getUser(owner)
                            if (user) {
                                hint = user.domain
                            }
                        } else {
                            hint = owner
                        }
                    }
                } catch (e) {
                    console.error('Failed to resolve hint for message', e)
                }

                return hint
            }

            return fetchHint().then((hint) => {
                return client!.getMessage<any>(props.uri!, hint).catch(() => undefined)
            })
        } else if (props.content) {
            // If no URI is provided, we can create a temporary message object from the content
            return Promise.resolve(JSON.parse(props.content))
        } else {
            return Promise.resolve(undefined)
        }
    }, [client, props.uri, props.source, props.content, props.lastUpdated])

    return (
        <Suspense fallback={<div>Loading message...</div>}>
            {useDeferredValue(<MessageContainerInner messagePromise={messagePromise} />)}
        </Suspense>
    )
}

interface InnerProps {
    messagePromise: Promise<any>
}

const MessageContainerInner = (props: InnerProps) => {
    const message: Message<any> = use(props.messagePromise)

    if (!message) return <div>Message not found</div>

    switch (message.schema) {
        case Schemas.markdownMessage:
            return <MarkdownMessage message={message} />
        case Schemas.replyMessage:
            return <ReplyMessage message={message} />
        case Schemas.rerouteMessage:
            return <RerouteMessage message={message} />
        case Schemas.likeAssociation:
            return <LikeAssociation message={message} />
        case 'https://raw.githubusercontent.com/totegamma/concurrent-schemas/master/messages/note/0.0.1.json':
            return <LegacyNoteMessage message={message} />
        default:
            return (
                <div>
                    <Text>Unsupported message schema: {message.schema}</Text>
                    <pre>{JSON.stringify(message, null, 2)}</pre>
                </div>
            )
    }
}
