import { useStack } from '../../layouts/Stack'
import { MessageProps } from './types'
import { MediaMessageSchema } from '@concrnt/worldlib'

import { ProfileView } from '../../views/Profile'
import { PostView } from '../../views/Post'

import { Avatar, CfmRenderer } from '@concrnt/ui'
import { MdPlayCircle, MdStop, MdViewInAr } from 'react-icons/md'

import { useMediaViewer } from '../../contexts/MediaViewer'
import { useAudioPlayer } from '../../contexts/AudioPlayer'
import { MessageLayout } from './MessageLayout'
import { TimeDiff } from '../TimeDiff'
import { MessageFooter } from './Footer'

export const MediaMessage = (props: MessageProps<MediaMessageSchema>) => {
    const { push } = useStack()
    const mediaViewer = useMediaViewer()
    const audioPlayer = useAudioPlayer()

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
                        push(<ProfileView ccid={message.author} />)
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
                <CfmRenderer messagebody={message.value.body} emojiDict={message.value.emojis ?? {}} />
            )}

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
                                if (media.mediaType.startsWith('image/')) {
                                    const imageMedias = medias.filter((m) => m.mediaType.startsWith('image/'))
                                    const viewerIndex = imageMedias.findIndex((m) => m.mediaURL === media.mediaURL)
                                    mediaViewer.open(imageMedias, viewerIndex >= 0 ? viewerIndex : 0)
                                } else if (media.mediaType.startsWith('audio/')) {
                                    if (audioPlayer.nowPlaying === media.mediaURL) {
                                        audioPlayer.stop()
                                    } else {
                                        audioPlayer.play(media.mediaURL)
                                    }
                                } else if (media.mediaType.startsWith('model/')) {
                                    mediaViewer.openModel(media.mediaURL)
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
                            ) : media.mediaType.startsWith('audio/') ? (
                                <div
                                    style={{
                                        width: '100%',
                                        height: medias.length === 1 ? '80px' : '100%',
                                        minHeight: '80px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        backgroundColor: 'rgba(0, 0, 0, 0.15)',
                                        cursor: 'pointer'
                                    }}
                                >
                                    {audioPlayer.nowPlaying === media.mediaURL ? (
                                        <MdStop size={48} style={{ color: 'rgba(255, 255, 255, 0.8)' }} />
                                    ) : (
                                        <MdPlayCircle size={48} style={{ color: 'rgba(255, 255, 255, 0.8)' }} />
                                    )}
                                </div>
                            ) : media.mediaType.startsWith('model/') ? (
                                <div
                                    style={{
                                        width: '100%',
                                        height: medias.length === 1 ? '120px' : '100%',
                                        minHeight: '100px',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        backgroundColor: 'rgba(0, 0, 0, 0.15)',
                                        cursor: 'pointer',
                                        gap: '8px'
                                    }}
                                >
                                    <MdViewInAr size={48} style={{ color: 'rgba(255, 255, 255, 0.8)' }} />
                                    <span style={{ color: 'rgba(255, 255, 255, 0.6)', fontSize: '12px' }}>
                                        3D Model
                                    </span>
                                </div>
                            ) : (
                                <div>Unsupported media type: {media.mediaType}</div>
                            )}
                        </div>
                    ))}
                </div>
            )}
            <MessageFooter message={message} />
        </MessageLayout>
    )
}
