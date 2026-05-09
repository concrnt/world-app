import { useStack } from '../../layouts/Stack'
import { MessageProps } from './types'
import { MarkdownMessageSchema } from '@concrnt/worldlib'

import { ProfileView } from '../../views/Profile'
import { PostView } from '../../views/Post'

import { Avatar, CfmRenderer } from '@concrnt/ui'

import { MessageLayout } from './MessageLayout'
import { TimeDiff } from '../TimeDiff'
import { MessageFooter } from './Footer'

export const MarkdownMessage = (props: MessageProps<MarkdownMessageSchema>) => {
    const { push } = useStack()

    const message = props.message

    return (
        <MessageLayout
            onClick={() => {
                push(<PostView uri={message.uri} />)
            }}
            left={
                <div
                    onClick={(e) => {
                        e.stopPropagation()
                        push(<ProfileView ccid={message.author} />)
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
