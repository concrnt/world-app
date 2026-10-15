import { useStack } from '../../layouts/Stack'
import { MessageProps } from './types'
import { MarkdownMessageSchema } from '@concrnt/worldlib'

import { ProfileView } from '../../views/Profile'
import { PostView } from '../../views/Post'

import { Avatar, CfmRenderer, CssVar } from '@concrnt/ui'

import { MessageLayout } from './MessageLayout'
import { MessageAuthor } from './MessageAuthor'
import { TimeDiff } from '../TimeDiff'
import { MessageFooter } from './Footer'
import { AutoSummary } from '../AutoSummary'
import { CollapsibleBody } from './CollapsibleBody'
import { TranslatedBody } from './TranslatedBody'
import { MessageTranslationProvider } from '../../contexts/MessageTranslation'

export const MarkdownMessage = (props: MessageProps<MarkdownMessageSchema>) => {
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
                    <Avatar
                        ccid={message.author}
                        src={message.authorProfile?.avatar}
                        badge={
                            // profileOverrideでアイコンが差し替えられた代理投稿(discord-bridge等)は、
                            // 差し替え前のアイコン(サービスアカウント自身)を右下に添えて出どころを示す
                            message.authorOriginalProfile && (
                                <Avatar
                                    ccid={message.author}
                                    src={message.authorOriginalProfile.avatar}
                                    style={{ width: '16px', height: '16px' }}
                                />
                            )
                        }
                        badgeColor={CssVar.contentBackground}
                        badgeSize={20}
                    />
                </div>
            }
            headerLeft={<MessageAuthor message={message} />}
            headerRight={<TimeDiff date={message.createdAt} />}
        >
            <MessageTranslationProvider text={message.value.body ?? ''}>
                <CollapsibleBody forceExpanded={props.forceExpanded}>
                    <AutoSummary body={message.value.body ?? ''}>
                        <CfmRenderer messagebody={message.value.body} emojiDict={message.value.emojis ?? {}} />
                    </AutoSummary>
                    <TranslatedBody
                        render={(text) => <CfmRenderer messagebody={text} emojiDict={message.value.emojis ?? {}} />}
                    />
                </CollapsibleBody>
                <MessageFooter message={message} rerouted={props.rerouted} />
            </MessageTranslationProvider>
        </MessageLayout>
    )
}
