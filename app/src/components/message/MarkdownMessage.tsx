import { useStack } from '../../layouts/Stack'
import { MessageProps } from './types'
import { MarkdownMessageSchema } from '@concrnt/worldlib'

import { ProfileView } from '../../views/Profile'
import { PostView } from '../../views/Post'

import { Avatar, CfmRenderer, CssVar } from '@concrnt/ui'

import { MessageActions } from './MessageActions'
import { MessageLayout } from './MessageLayout'
import { TimeDiff } from '../TimeDiff'
import { PostedTimelines } from './PostedTimelines'

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
                        push(<ProfileView id={message.author} />)
                    }}
                >
                    <Avatar ccid={message.author} src={message.authorUser?.profile.avatar} />
                </div>
            }
            headerLeft={
                <div
                    style={{
                        fontWeight: 'bold'
                    }}
                >
                    {message.authorUser?.profile.username || 'Anonymous'}
                </div>
            }
            headerRight={<TimeDiff date={message.createdAt} />}
        >
            <CfmRenderer messagebody={message.value.body} emojiDict={{}} />
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
