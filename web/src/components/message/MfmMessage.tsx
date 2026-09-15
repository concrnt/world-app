import { MessageProps } from './types'
import { MfmMessageSchema } from '@concrnt/worldlib'

import { Avatar, MfmRenderer } from '@concrnt/ui'

import { MessageLayout } from './MessageLayout'
import { MessageAuthor } from './MessageAuthor'
import { TimeDiff } from '../TimeDiff'
import { useNavigate } from 'react-router-dom'
import { MessageFooter } from './Footer'
import { AutoSummary } from '../AutoSummary'
import { CollapsibleBody } from './CollapsibleBody'
import { TranslatableBody } from './TranslatableBody'
import { MessageTranslationProvider } from '../../contexts/MessageTranslation'

export const MfmMessage = (props: MessageProps<MfmMessageSchema>) => {
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
                        navigate(
                            '/profile/' +
                                message.author +
                                (message.authorProfileName && message.authorProfileName !== 'main'
                                    ? '/' + message.authorProfileName
                                    : '')
                        )
                    }}
                >
                    <Avatar
                        ccid={message.author}
                        src={message.authorProfile?.avatar}
                        style={{ width: '48px', height: '48px' }}
                    />
                </div>
            }
            headerLeft={<MessageAuthor message={message} />}
            headerRight={<TimeDiff date={message.createdAt} />}
        >
            <MessageTranslationProvider text={message.value.body ?? ''} syntax="mfm">
                <CollapsibleBody forceExpanded={props.forceExpanded}>
                    <AutoSummary body={message.value.body ?? ''}>
                        <TranslatableBody
                            renderTranslated={(text) => (
                                <MfmRenderer messagebody={text} emojiDict={message.value.emojis ?? {}} />
                            )}
                        >
                            <MfmRenderer messagebody={message.value.body} emojiDict={message.value.emojis ?? {}} />
                        </TranslatableBody>
                    </AutoSummary>
                </CollapsibleBody>
                <MessageFooter message={message} rerouted={props.rerouted} />
            </MessageTranslationProvider>
        </MessageLayout>
    )
}
