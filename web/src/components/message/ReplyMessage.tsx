import { MessageProps } from './types'
import { ReplyMessageSchema } from '@concrnt/worldlib'

import { Avatar, CfmRenderer } from '@concrnt/ui'

import { MessageLayout } from './MessageLayout'
import { MessageAuthor } from './MessageAuthor'
import { MessageContainer } from './main'
import { RenderError } from './RenderError'
import { ErrorBoundary } from 'react-error-boundary'
import { TimeDiff } from '../TimeDiff'
import { useNavigate } from 'react-router-dom'
import { MessageFooter } from './Footer'
import { AutoSummary } from '../AutoSummary'
import { CCUserChip } from '../CCUserChip'
import { MdReply } from 'react-icons/md'
import { CollapsibleBody } from './CollapsibleBody'

export const ReplyMessage = (props: MessageProps<ReplyMessageSchema>) => {
    const navigate = useNavigate()

    return (
        <div
            style={{
                display: 'flex',
                flexDirection: 'column'
            }}
        >
            <ErrorBoundary FallbackComponent={RenderError}>
                <MessageContainer oneline uri={props.message.value.targetURI} />
            </ErrorBoundary>
            <MessageLayout
                detail={props.detail}
                onClick={() => {
                    navigate('/post/' + encodeURIComponent(props.message.uri))
                }}
                left={
                    <div
                        onClick={(e) => {
                            e.stopPropagation()
                            navigate(
                                '/profile/' +
                                    props.message.author +
                                    (props.message.authorProfileName && props.message.authorProfileName !== 'main'
                                        ? '/' + props.message.authorProfileName
                                        : '')
                            )
                        }}
                    >
                        <Avatar
                            ccid={props.message.author}
                            src={props.message.authorProfile?.avatar}
                            style={{ width: '48px', height: '48px' }}
                        />
                    </div>
                }
                headerLeft={<MessageAuthor message={props.message} />}
                headerRight={<TimeDiff date={props.message.createdAt} />}
            >
                {props.message.value.replyToMessageAuthor && (
                    <CCUserChip iconOverride={<MdReply size={16} />} ccid={props.message.value.replyToMessageAuthor} />
                )}
                <CollapsibleBody forceExpanded={props.forceExpanded}>
                    <AutoSummary body={props.message.value.body ?? ''}>
                        <CfmRenderer
                            messagebody={props.message.value.body}
                            emojiDict={props.message.value.emojis ?? {}}
                        />
                    </AutoSummary>
                </CollapsibleBody>
                <MessageFooter message={props.message} rerouted={props.rerouted} />
            </MessageLayout>
        </div>
    )
}
