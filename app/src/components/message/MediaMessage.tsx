import { useStack } from '../../layouts/Stack'
import { MessageProps } from './types'
import { MediaMessageSchema } from '@concrnt/worldlib'

import { ProfileView } from '../../views/Profile'
import { PostView } from '../../views/Post'

import { Avatar, CfmRenderer } from '@concrnt/ui'

import { useMediaViewer } from '../../contexts/MediaViewer'
import { MessageActions } from './MessageActions'
import { MessageLayout } from './MessageLayout'
import { TimeDiff } from '../TimeDiff'

export const MediaMessage = (props: MessageProps<MediaMessageSchema>) => {
    const { push } = useStack()
    const mediaViewer = useMediaViewer()

    const message = props.message

    const medias = message.value.medias ?? []

    return (
        <MessageLayout
            onClick={() => {
                push(<PostView uri={message.uri} />)
            }}
            left={
                <div
                    onClick={(e) => {
                        e.stopPropagation()
                        push(<ProfileView id={message.author} />)
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
            {message.value.body && <CfmRenderer messagebody={message.value.body} emojiDict={{}} />}

            {medias.length > 0 && (
                <div
                    style={{
                        display: 'grid',
                        gridTemplateColumns: medias.length === 1 ? '1fr' : 'repeat(2, 1fr)',
                        gap: '4px',
                        marginTop: '8px'
                    }}
                >
                    {medias.map((media, index) => (
                        <div
                            key={index}
                            style={{
                                position: 'relative',
                                overflow: 'hidden',
                                borderRadius: '8px',
                                aspectRatio: medias.length === 1 ? 'auto' : '1'
                            }}
                            onClick={(e) => {
                                e.stopPropagation()
                                const imageMedias = medias.filter((m) => m.mediaType.startsWith('image/'))
                                const viewerIndex = imageMedias.findIndex((m) => m.mediaURL === media.mediaURL)
                                if (media.mediaType.startsWith('image/')) {
                                    mediaViewer.open(imageMedias, viewerIndex >= 0 ? viewerIndex : 0)
                                }
                            }}
                        >
                            {media.mediaType.startsWith('image/') ? (
                                <img
                                    src={media.mediaURL}
                                    alt={media.altText ?? ''}
                                    style={{
                                        width: '100%',
                                        height: medias.length === 1 ? 'auto' : '100%',
                                        maxHeight: medias.length === 1 ? '300px' : undefined,
                                        objectFit: 'cover',
                                        cursor: 'pointer'
                                    }}
                                />
                            ) : media.mediaType.startsWith('video/') ? (
                                <video
                                    src={media.mediaURL}
                                    controls
                                    style={{
                                        width: '100%',
                                        maxHeight: '300px'
                                    }}
                                />
                            ) : (
                                <div>Unsupported media type: {media.mediaType}</div>
                            )}
                        </div>
                    ))}
                </div>
            )}
            <MessageActions message={message} />
        </MessageLayout>
    )
}
