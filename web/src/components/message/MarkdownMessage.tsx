import { MessageProps } from './types'
import { MarkdownMessageSchema } from '@concrnt/worldlib'

import { Avatar, CfmRenderer, CssVar } from '@concrnt/ui'

import { MessageActions } from './MessageActions'
import { MessageLayout } from './MessageLayout'
import { TimeDiff } from '../TimeDiff'
import { PostedTimelines } from './PostedTimelines'
import { useNavigate } from 'react-router-dom'

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
            <div
                style={{
                    display: 'flex',
                    flexDirection: 'row-reverse',
                    justifyContent: 'space-between',
                    alignItems: 'stretch',
                    flexWrap: 'wrap',
                    gap: CssVar.space(1)
                }}
            >
                <div
                    style={{
                        display: 'flex',
                        flexDirection: 'row',
                        alignItems: 'center'
                    }}
                >
                    <PostedTimelines message={message} />
                </div>
                <div
                    style={{
                        flex: 1,
                        display: 'flex',
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'flex-start'
                    }}
                >
                    <MessageActions message={message} />
                </div>
            </div>
        </MessageLayout>
    )
}
