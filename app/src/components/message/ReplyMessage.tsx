import { useStack } from '../../layouts/Stack'
import { MessageProps } from './types'
import { ReplyMessageSchema } from '@concrnt/worldlib'

import { ProfileView } from '../../views/Profile'
import { PostView } from '../../views/Post'

import { Avatar, CfmRenderer, CssVar } from '@concrnt/ui'

import { MessageLayout } from './MessageLayout'
import { MessageContainer } from './main'
import { RenderError } from './RenderError'
import { ErrorBoundary } from 'react-error-boundary'
import { TimeDiff } from '../TimeDiff'
import { MessageFooter } from './Footer'
import { AutoSummary } from '../AutoSummary'
import { CCUserChip } from '../CCUserChip'
import { MdReply } from 'react-icons/md'
import { CollapsibleBody } from './CollapsibleBody'

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
            <ErrorBoundary FallbackComponent={RenderError}>
                <MessageContainer oneline uri={props.message.value.targetURI} />
            </ErrorBoundary>
            <MessageLayout
                detail={props.detail}
                onClick={() => {
                    push(<PostView uri={props.message.uri} />)
                }}
                left={
                    <div
                        onClick={(e) => {
                            e.stopPropagation()
                            push(<ProfileView ccid={props.message.author} />)
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
