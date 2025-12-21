import { memo, ReactNode, Suspense, use } from "react"
import { useClient } from "../../contexts/Client"
import { useStack } from "../../layouts/Stack"
import { ProfileView } from "../../views/Profile"
import { PostView } from "../../views/Post"

interface Props {
    uri: string
    resolveHint?: string
    lastUpdated?: number
}

export const MessageContainer = memo<Props>((props: Props): ReactNode | null => {

    return <Suspense fallback={<div>Loading message...</div>}>
        <Message {...props} />
    </Suspense>

})

const Message = (props: Props) => {
    const { client } = useClient()

    const { push } = useStack()

    const message = use(client!.getMessage<any>(props.uri, props.resolveHint))

    if (!message) return <div>Message not found</div>

    return <div
        style={{ 
            display: 'flex',
            flexDirection: 'row',
            gap: '8px',
        }}
    >
        <div
            onClick={() => {
                push(<ProfileView id={message.author} />)
            }}
        >
            <img 
                src={message.authorUser?.profile.avatar} 
                alt="avatar" 
                style={{ 
                    width: '40px', 
                    height: '40px', 
                    borderRadius: '4px', 
                }} 
            />
        </div>
        <div
            style={{ 
                display: 'flex',
                flexDirection: 'column',
                gap: '4px',
            }}
            onClick={() => {
                push(<PostView uri={message.uri} />)
            }}
        >
            <div
                style={{ 
                    fontWeight: 'bold',
                }}
            >
                {message.authorUser?.profile.username}
            </div>
            <div
                style={{ 
                }}
            >
                {message.value.body}
            </div>
        </div>
    </div>

}

