import { CssVar } from '../../types/Theme'
import { MediaMessageSchema } from '@concrnt/worldlib'
import { GalleryImage } from './Image'
import { GalleryVideo } from './Video'
import { GalleryAudio } from './Audio'
import { GalleryModel } from './Model'
import { Blurhash } from 'react-blurhash'
import { useMediaViewer } from '../../contexts/MediaViewer'

export type Media = NonNullable<MediaMessageSchema['medias']>[number]

interface Props {
    medias: Media[]
}

export const MediaGallery = (props: Props) => {
    const mediaViewer = useMediaViewer()

    return (
        <div
            style={{
                display: 'flex',
                gap: CssVar.space(2),
                overflowX: 'auto',
                height: '200px'
            }}
        >
            {props.medias.map((media, index) => (
                <Media
                    key={index}
                    media={media}
                    onClick={() => {
                        mediaViewer.open(props.medias, index)
                    }}
                />
            ))}
        </div>
    )
}

const Media = (props: { media: Media; onClick?: () => void }) => {
    return (
        <div
            style={{
                overflow: 'hidden',
                borderRadius: CssVar.round(2),
                aspectRatio: '4/3',
                position: 'relative',
                cursor: 'pointer'
            }}
            onClick={(e) => {
                e.stopPropagation()
                props.onClick?.()
            }}
        >
            <div
                style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: '100%',
                    backgroundColor: '#111'
                }}
            >
                {props.media.blurhash && (
                    <Blurhash
                        hash={props.media.blurhash}
                        height={'100%'}
                        width={'100%'}
                        punch={1}
                        resolutionX={32}
                        resolutionY={32}
                    />
                )}
            </div>
            <div
                style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: '100%'
                }}
            >
                <MediaBody media={props.media} />
            </div>
        </div>
    )
}

const MediaBody = (props: { media: Media }) => {
    const kind = props.media.mediaType.split('/')[0]
    switch (kind) {
        case 'image':
            return <GalleryImage media={props.media} />
        case 'video':
            return <GalleryVideo media={props.media} />
        case 'audio':
            return <GalleryAudio media={props.media} />
        case 'model':
            return <GalleryModel />
        default:
            return (
                <div
                    style={{
                        width: '100%',
                        height: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: 'rgba(0, 0, 0, 0.15)',
                        color: 'rgba(255, 255, 255, 0.8)',
                        fontSize: '12px'
                    }}
                >
                    Unsupported media type: {props.media.mediaType}
                </div>
            )
    }
}
