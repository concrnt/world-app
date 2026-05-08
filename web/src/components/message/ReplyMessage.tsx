import { MessageProps } from './types'
import { ReplyMessageSchema } from '@concrnt/worldlib'

import { Avatar, CfmRenderer, CssVar } from '@concrnt/ui'

import { MessageActions } from './MessageActions'
import { MessageLayout } from './MessageLayout'
import { MessageReactions } from './MessageReactions'
import { MessageContainer } from './main'
import { TimeDiff } from '../TimeDiff'
import { PostedTimelines } from './PostedTimelines'
import { useNavigate } from 'react-router-dom'

export const ReplyMessage = (props: MessageProps<ReplyMessageSchema>) => {
    const navigate = useNavigate()

    return (
        <div
            style={{
                display: 'flex',
                flexDirection: 'column',
                gap: CssVar.space(1)
            }}
        >
            <MessageContainer oneline uri={props.message.value.replyToMessageId} />
            <MessageLayout
                onClick={() => {
                    navigate('/post/' + encodeURIComponent(props.message.uri))
                }}
                left={
                    <div
                        onClick={(e) => {
                            e.stopPropagation()
                            navigate('/profile/' + props.message.author)
                        }}
                    >
                        <Avatar ccid={props.message.author} src={props.message.authorUser?.profile.avatar} />
                    </div>
                }
                headerLeft={
                    <div
                        style={{
                            fontWeight: 'bold'
                        }}
                    >
                        {props.message.authorUser?.profile.username || 'Anonymous'}
                    </div>
                }
                headerRight={<TimeDiff date={props.message.createdAt} />}
            >
                <CfmRenderer messagebody={props.message.value.body} emojiDict={props.message.value.emojis ?? {}} />
                <MessageReactions message={props.message} />
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
                        <PostedTimelines message={props.message} />
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
                        <MessageActions message={props.message} />
                    </div>
                </div>
            </MessageLayout>
        </div>
    )
}
