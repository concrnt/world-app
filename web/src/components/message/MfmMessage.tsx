import { MessageProps } from './types'
import { MfmMessageSchema } from '@concrnt/worldlib'

import { Avatar, CssVar } from '@concrnt/ui'
import { MfmRenderer } from '../MfmRenderer'

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
            message={message}
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
                        badge={
                            // profileOverrideでアイコンが差し替えられた代理投稿(discord-bridge等)は、
                            // 差し替え前のアイコン(サービスアカウント自身)を右下に添えて出どころを示す
                            message.authorOriginalProfile && (
                                <Avatar
                                    ccid={message.author}
                                    src={message.authorOriginalProfile.avatar}
                                    style={{ width: '18px', height: '18px' }}
                                />
                            )
                        }
                        badgeColor={CssVar.contentBackground}
                        badgeSize={22}
                    />
                </div>
            }
            headerLeft={<MessageAuthor message={message} />}
            headerRight={<TimeDiff date={message.createdAt} />}
        >
            <MessageTranslationProvider>
                <CollapsibleBody forceExpanded={props.forceExpanded}>
                    <AutoSummary body={message.value.body ?? ''}>
                        <TranslatableBody>
                            <MfmRenderer messagebody={message.value.body} emojiDict={message.value.emojis ?? {}} />
                        </TranslatableBody>
                    </AutoSummary>
                </CollapsibleBody>
                <MessageFooter message={message} rerouted={props.rerouted} />
            </MessageTranslationProvider>
        </MessageLayout>
    )
}
