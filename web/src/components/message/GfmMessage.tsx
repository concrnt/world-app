import { MessageProps } from './types'
import { GfmMessageSchema } from '@concrnt/worldlib'

import { Avatar, GfmRenderer } from '@concrnt/ui'

import { MessageLayout } from './MessageLayout'
import { TimeDiff } from '../TimeDiff'
import { useNavigate } from 'react-router-dom'
import { MessageFooter } from './Footer'
import { AutoSummary } from '../AutoSummary'
import { CollapsibleBody } from './CollapsibleBody'

export const GfmMessage = (props: MessageProps<GfmMessageSchema>) => {
    const navigate = useNavigate()

    const message = props.message

    return (
        <MessageLayout
            detail={props.detail}
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
            <CollapsibleBody forceExpanded={props.forceExpanded}>
                <AutoSummary body={message.value.body ?? ''}>
                    <GfmRenderer messagebody={message.value.body} emojiDict={message.value.emojis} />
                </AutoSummary>
            </CollapsibleBody>
            <MessageFooter message={message} rerouted={props.rerouted} />
        </MessageLayout>
    )
}
