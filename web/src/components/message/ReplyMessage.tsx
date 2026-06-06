import { MessageProps } from './types'
import { ReplyMessageSchema } from '@concrnt/worldlib'

import { Avatar, CfmRenderer, CssVar } from '@concrnt/ui'

import { MessageLayout } from './MessageLayout'
import { MessageContainer } from './main'
import { TimeDiff } from '../TimeDiff'
import { useNavigate } from 'react-router-dom'
import { MessageFooter } from './Footer'
import { AutoSummary } from '../AutoSummary'

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
            <MessageContainer oneline uri={props.message.value.targetURI} />
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
                <AutoSummary body={props.message.value.body ?? ''}>
                    <CfmRenderer messagebody={props.message.value.body} emojiDict={props.message.value.emojis ?? {}} />
                </AutoSummary>
                <MessageFooter message={props.message} />
            </MessageLayout>
        </div>
    )
}
