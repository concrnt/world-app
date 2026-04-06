import { useClient } from '../../contexts/Client'
import { useStack } from '../../layouts/Stack'
import { MessageProps } from './types'
import { MediaMessageSchema } from '@concrnt/worldlib'

import { ProfileView } from '../../views/Profile'
import { PostView } from '../../views/Post'

import { Avatar, CfmRenderer, Text, IconButton } from '@concrnt/ui'

import { MdMoreHoriz } from 'react-icons/md'
import { useSelect } from '../../contexts/Select'
import { useMediaViewer } from '../../contexts/MediaViewer'
import { MessageActions } from './MessageActions'

export const MediaMessage = (props: MessageProps<MediaMessageSchema>) => {
    const { push } = useStack()
    const { client } = useClient()
    const { select } = useSelect()
    const mediaViewer = useMediaViewer()

    const message = props.message

    const medias = message.value.medias ?? []

    return (
        <div
            style={{
                display: 'flex',
                flexDirection: 'row',
                gap: '8px'
            }}
            onClick={(e) => {
                e.stopPropagation()
                push(<PostView uri={message.uri} />)
            }}
        >
            <div
                onClick={(e) => {
                    e.stopPropagation()
                    push(<ProfileView id={message.author} />)
                }}
            >
                <Avatar ccid={message.author} src={message.authorUser?.profile.avatar} />
            </div>
            <div
                style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px',
                    flex: 1
                }}
            >
                <div
                    style={{
                        display: 'flex',
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '8px'
                    }}
                >
                    <div
                        style={{
                            fontWeight: 'bold'
                        }}
                    >
                        {message.authorUser?.profile.username}
                    </div>
                    <IconButton
                        onClick={(e) => {
                            e.stopPropagation()
                            select(
                                '',
                                {
                                    delete: <Text>投稿を削除</Text>
                                },
                                (key) => {
                                    if (key === 'delete') {
                                        client?.api.delete(message.uri)
                                    }
                                }
                            )
                        }}
                        style={{
                            padding: 0,
                            margin: 0
                        }}
                    >
                        <MdMoreHoriz size={15} />
                    </IconButton>
                </div>

                {/* テキスト本文 */}
                {message.value.body && <CfmRenderer messagebody={message.value.body} emojiDict={{}} />}

                {/* 画像表示 */}
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
            </div>
        </div>
    )
}
