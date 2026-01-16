import { ReactNode, Suspense, use, useMemo } from 'react'
import { useClient } from '../../contexts/Client'
import { useStack } from '../../layouts/Stack'
import { ProfileView } from '../../views/Profile'
import { PostView } from '../../views/Post'
import { Avatar } from '../../ui/Avatar'

import { IsCCID, parseCCURI } from '@concrnt/client'
import { CfmRenderer } from '../../ui/CfmRenderer'

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
    const { push } = useStack()

    const message = use(props.messagePromise)

    if (!message) return <div>Message not found</div>

    return (
        <div
            style={{
                display: 'flex',
                flexDirection: 'row',
                gap: '8px',
                contentVisibility: 'auto'
            }}
            onClick={(e) => {
                e.stopPropagation()
                push(<PostView uri={message.uri} />)
            }}
        >
            <div
                onClick={(e) => {
                    e.stopPropagation()
                    push(<ProfileView id={message.author} />)
                }}
            >
                <Avatar ccid={message.author} src={message.authorUser?.profile.avatar} />
            </div>
            <div
                style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px'
                }}
            >
                <div
                    style={{
                        fontWeight: 'bold'
                    }}
                >
                    {message.authorUser?.profile.username}
                </div>
                <CfmRenderer messagebody={message.value.body} emojiDict={{}} />
            </div>
        </div>
    )
}
