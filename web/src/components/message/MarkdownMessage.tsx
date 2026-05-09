import { MessageProps } from './types'
import { MarkdownMessageSchema } from '@concrnt/worldlib'

import { Avatar, CfmRenderer } from '@concrnt/ui'

import { MessageLayout } from './MessageLayout'
import { TimeDiff } from '../TimeDiff'
import { useNavigate } from 'react-router-dom'
import { MessageFooter } from './Footer'

export const MarkdownMessage = (props: MessageProps<MarkdownMessageSchema>) => {
    const navigate = useNavigate()

    const message = props.message

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
                    <Avatar ccid={message.author} src={message.authorProfile?.avatar} />
                </div>
            }
            headerLeft={
                <div
                    style={{
                        fontWeight: 'bold'
                    }}
                >
                    {message.authorProfile?.username || 'Anonymous'}
                </div>
            }
            headerRight={<TimeDiff date={message.createdAt} />}
        >
            <CfmRenderer messagebody={message.value.body} emojiDict={message.value.emojis ?? {}} />
            <MessageFooter message={message} />
        </MessageLayout>
    )
}
