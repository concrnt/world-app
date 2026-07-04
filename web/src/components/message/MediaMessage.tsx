import { MessageProps } from './types'
import { MediaMessageSchema } from '@concrnt/worldlib'

import { Avatar, CfmRenderer } from '@concrnt/ui'

import { MessageLayout } from './MessageLayout'
import { TimeDiff } from '../TimeDiff'
import { useNavigate } from 'react-router-dom'
import { MessageFooter } from './Footer'
import { AutoSummary } from '../AutoSummary'
import { MediaGallery } from '../MediaGallery/main'

export const MediaMessage = (props: MessageProps<MediaMessageSchema>) => {
    const navigate = useNavigate()

    const message = props.message

    return (
        <MessageLayout
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
            {message.value.body && (
                <AutoSummary body={message.value.body}>
                    <CfmRenderer messagebody={message.value.body} emojiDict={message.value.emojis ?? {}} />
                </AutoSummary>
            )}

            <MediaGallery medias={message.value.medias ?? []} />
            <MessageFooter message={message} />
        </MessageLayout>
    )
}
