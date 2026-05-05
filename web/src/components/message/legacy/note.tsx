import { MessageProps } from '../types'

import { Avatar, CfmRenderer } from '@concrnt/ui'
import { MessageLayout } from '../MessageLayout'
import { useNavigate } from 'react-router-dom'

export const LegacyNoteMessage = (props: MessageProps<any>) => {
    const navigate = useNavigate()

    const message = props.message
    const legacyMessage = JSON.parse(message.value.body)

    return (
        <MessageLayout
            onClick={() => {
                navigate('/post/' + encodeURIComponent(message.uri))
            }}
            left={
                <div
                    onClick={(e) => {
                        e.stopPropagation()
                        navigate('/profile/' + message.author)
                    }}
                >
                    <Avatar ccid={message.author} />
                </div>
            }
            headerLeft={
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
            }
        >
            <CfmRenderer messagebody={legacyMessage.body} emojiDict={{}} />
            {/*
            <pre>
                {JSON.stringify(message, null, 2)}
            </pre>
            */}
        </MessageLayout>
    )
}
