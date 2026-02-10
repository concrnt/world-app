import { ReactNode, Suspense, use, useMemo } from 'react'
import { IsCCID, parseCCURI } from '@concrnt/client'

import { useClient } from '../../contexts/Client'
import { Text } from '../../ui/Text'
import { Message, Schemas } from '@concrnt/worldlib'
import { MarkdownMessage } from './MarkdownMessage'
import { LikeAssociation } from './LikeAssociation'

interface Props {
    uri: string
    source?: string
    lastUpdated?: number
}

export const MessageContainer = (props: Props): ReactNode | null => {
    const { client } = useClient()

    const messagePromise = useMemo(() => {
        console.log('Fetching message', props.uri)

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
            return client!.getMessage<any>(props.uri, hint).catch(() => undefined)
        })
    }, [client, props.uri, props.source])

    return (
        <Suspense fallback={<div>Loading message...</div>}>
            <MessageContainerInner messagePromise={messagePromise} />
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
        case Schemas.likeAssociation:
            return <LikeAssociation message={message} />
        default:
            return (
                <div>
                    <Text>Unsupported message schema: {message.schema}</Text>
                    <pre>{JSON.stringify(message, null, 2)}</pre>
                </div>
            )
    }
}
