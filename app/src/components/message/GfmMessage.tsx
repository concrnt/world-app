import { useStack } from '../../layouts/Stack'
import { MessageProps } from './types'
import { GfmMessageSchema } from '@concrnt/worldlib'

import { ProfileView } from '../../views/Profile'
import { PostView } from '../../views/Post'

import { Avatar, GfmRenderer } from '@concrnt/ui'

import { MessageLayout } from './MessageLayout'
import { MessageAuthor } from './MessageAuthor'
import { TimeDiff } from '../TimeDiff'
import { MessageFooter } from './Footer'
import { AutoSummary } from '../AutoSummary'
import { CollapsibleBody } from './CollapsibleBody'
import { TranslatableBody } from './TranslatableBody'
import { MessageTranslationProvider } from '../../contexts/MessageTranslation'

export const GfmMessage = (props: MessageProps<GfmMessageSchema>) => {
    const { push } = useStack()

    const message = props.message

    return (
        <MessageLayout
            detail={props.detail}
            onClick={() => {
                push(<PostView uri={message.uri} />)
            }}
            left={
                <div
                    onClick={(e) => {
                        e.stopPropagation()
                        push(<ProfileView ccid={message.author} profileName={message.authorProfileName ?? undefined} />)
                    }}
                >
                    <Avatar ccid={message.author} src={message.authorProfile?.avatar} />
                </div>
            }
            headerLeft={<MessageAuthor message={message} />}
            headerRight={<TimeDiff date={message.createdAt} />}
        >
            <MessageTranslationProvider text={message.value.body ?? ''} syntax="gfm">
                <CollapsibleBody forceExpanded={props.forceExpanded}>
                    <AutoSummary body={message.value.body ?? ''}>
                        <TranslatableBody
                            renderTranslated={(text) => (
                                <GfmRenderer messagebody={text} emojiDict={message.value.emojis} />
                            )}
                        >
                            <GfmRenderer messagebody={message.value.body} emojiDict={message.value.emojis} />
                        </TranslatableBody>
                    </AutoSummary>
                </CollapsibleBody>
                <MessageFooter message={message} rerouted={props.rerouted} />
            </MessageTranslationProvider>
        </MessageLayout>
    )
}
