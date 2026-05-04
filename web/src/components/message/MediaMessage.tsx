import { Avatar, CfmRenderer, CssVar, Text } from '@concrnt/ui'
import { useNavigate } from 'react-router-dom'
import type { MediaMessageSchema } from '@concrnt/worldlib'
import type { MessageProps } from './types'
import { MessageActions } from './MessageActions'
import { MessageDestinations } from './common'
import { formatTimestamp } from './utils'

export const MediaMessage = (props: MessageProps<MediaMessageSchema>) => {
    const navigate = useNavigate()
    const message = props.message
    const medias = message.value.medias ?? []

    return (
        <div
            style={{
                display: 'flex',
                flexDirection: 'row',
                gap: CssVar.space(2)
            }}
        >
            <button
                type="button"
                onClick={() => navigate(`/profile/${encodeURIComponent(message.author)}`)}
                style={{ border: 'none', backgroundColor: 'transparent', cursor: 'pointer' }}
            >
                <Avatar ccid={message.author} src={message.authorProfile.avatar} />
            </button>
            <div
                style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: CssVar.space(2),
                    flex: 1,
                    minWidth: 0
                }}
            >
                <div
                    style={{
                        display: 'flex',
                        alignItems: 'baseline',
                        gap: CssVar.space(2),
                        flexWrap: 'wrap'
                    }}
                >
                    <button
                        type="button"
                        onClick={() => navigate(`/profile/${encodeURIComponent(message.author)}`)}
                        style={{
                            border: 'none',
                            backgroundColor: 'transparent',
                            padding: 0,
                            fontWeight: 700,
                            cursor: 'pointer',
                            color: CssVar.contentText
                        }}
                    >
                        {message.authorProfile.username}
                    </button>
                    <button
                        type="button"
                        onClick={() => navigate(`/post/${encodeURIComponent(message.uri)}`)}
                        style={{
                            border: 'none',
                            backgroundColor: 'transparent',
                            padding: 0,
                            cursor: 'pointer',
                            color: CssVar.contentText,
                            opacity: 0.72
                        }}
                    >
                        <Text variant="caption">{formatTimestamp(message.createdAt)}</Text>
                    </button>
                </div>

                {message.value.body && <CfmRenderer messagebody={message.value.body} emojiDict={{}} />}

                {medias.length > 0 && (
                    <div
                        style={{
                            display: 'grid',
                            gridTemplateColumns: medias.length === 1 ? '1fr' : 'repeat(2, 1fr)',
                            gap: CssVar.space(1)
                        }}
                    >
                        {medias.map((media) => (
                            <button
                                key={media.mediaURL}
                                type="button"
                                onClick={() => navigate(`/post/${encodeURIComponent(message.uri)}`)}
                                style={{
                                    border: 'none',
                                    backgroundColor: 'transparent',
                                    padding: 0,
                                    overflow: 'hidden',
                                    borderRadius: CssVar.round(1),
                                    cursor: 'pointer'
                                }}
                            >
                                {media.mediaType.startsWith('image/') ? (
                                    <img
                                        src={media.mediaURL}
                                        alt={media.altText ?? ''}
                                        style={{
                                            width: '100%',
                                            height: medias.length === 1 ? 'auto' : '200px',
                                            objectFit: 'cover'
                                        }}
                                    />
                                ) : (
                                    <video src={media.mediaURL} controls style={{ width: '100%', maxHeight: '300px' }} />
                                )}
                            </button>
                        ))}
                    </div>
                )}

                <MessageDestinations message={message} />
                <MessageActions message={message} />
            </div>
        </div>
    )
}
