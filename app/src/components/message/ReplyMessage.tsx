import { useStack } from '../../layouts/Stack'
import { MessageProps } from './types'
import { ReplyMessageSchema } from '@concrnt/worldlib'

import { ProfileView } from '../../views/Profile'
import { PostView } from '../../views/Post'

import { Avatar, CfmRenderer, CssVar } from '@concrnt/ui'

import { MessageActions } from './MessageActions'
import { MessageLayout } from './MessageLayout'
import { MessageContainer } from './main'
import { TimeDiff } from '../TimeDiff'
import { PostedTimelines } from './PostedTimelines'

export const ReplyMessage = (props: MessageProps<ReplyMessageSchema>) => {
    const { push } = useStack()

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
                    push(<PostView uri={props.message.uri} />)
                }}
                left={
                    <div
                        onClick={(e) => {
                            e.stopPropagation()
                            push(<ProfileView id={props.message.author} />)
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
                <CfmRenderer messagebody={props.message.value.body} emojiDict={{}} />
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
