import { ReactNode, use, useMemo } from 'react'
import { useClient } from '../../contexts/Client'
import { useStack } from '../../layouts/Stack'
import { ProfileView } from '../../views/Profile'
import { PostView } from '../../views/Post'
import { Avatar } from '../../ui/Avatar'

interface Props {
    uri: string
    resolveHint?: string
    lastUpdated?: number
}

export const MessageContainer = (props: Props): ReactNode | null => {
    const { client } = useClient()

    const { push } = useStack()

    const messagePromise = useMemo(() => {
        return client!.getMessage<any>(props.uri, props.resolveHint)
    }, [client, props.uri, props.resolveHint])
    const message = use(messagePromise)

    if (!message) return <div>Message not found</div>

    return (
        <div
            style={{
                display: 'flex',
                flexDirection: 'row',
                gap: '8px'
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
                <div style={{}}>{message.value.body}</div>
            </div>
        </div>
    )
}
