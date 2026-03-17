import { useStack } from '../../../layouts/Stack'
import { MessageProps } from '../types'

import { ProfileView } from '../../../views/Profile'
import { PostView } from '../../../views/Post'

import { Avatar, CfmRenderer } from '@concrnt/ui'

export const LegacyNoteMessage = (props: MessageProps<any>) => {
    const { push } = useStack()

    const message = props.message
    const legacyMessage = JSON.parse(message.value.body)

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
                <Avatar ccid={message.author} />
            </div>
            <div
                style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px',
                    flex: 1
                }}
            >
                <div
                    style={{
                        display: 'flex',
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: '8px'
                    }}
                >
                    <div
                        style={{
                            fontWeight: 'bold'
                        }}
                    >
                        {message.author.slice(0, 16)}...
                    </div>
                    <div>{new Date(message.createdAt).toLocaleString()}</div>
                </div>
                <CfmRenderer messagebody={legacyMessage.body} emojiDict={{}} />
                {/*
                <pre>
                    {JSON.stringify(message, null, 2)}
                </pre>
                */}
            </div>
        </div>
    )
}
