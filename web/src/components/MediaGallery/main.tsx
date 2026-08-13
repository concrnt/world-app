import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { CssVar, HorizontalLayout, IconButton, Text } from '@concrnt/ui'
import { MediaMessageSchema } from '@concrnt/worldlib'
import { GalleryImage } from './Image'
import { GalleryVideo } from './Video'
import { GalleryAudio } from './Audio'
import { GalleryModel } from './Model'
import { Blurhash } from 'react-blurhash'
import { MdVisibilityOff } from 'react-icons/md'
import { useMediaViewer } from '../../contexts/MediaViewer'

export type Media = NonNullable<MediaMessageSchema['medias']>[number]

interface Props {
    medias: Media[]
}

export const MediaGallery = (props: Props) => {
    const mediaViewer = useMediaViewer()

    return (
        <HorizontalLayout
            style={{
                gap: CssVar.space(2),
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
        </HorizontalLayout>
    )
}

const Media = (props: { media: Media; onClick?: () => void }) => {
    const { t } = useTranslation('', { keyPrefix: 'components.mediaGallery' })
    // 解除状態はURL単位でセッション内共有する(v1と同じ。画面遷移でアンマウントされても再ブラーしない)
    const [revealed, setRevealed] = useState(() => sessionStorage.getItem('reveal:' + props.media.mediaURL) === 'true')
    const hidden = !!props.media.flag && !revealed

    const flagLabels: Record<string, string> = {
        warn: t('flagWarn'),
        nude: t('flagNude'),
        porn: t('flagPorn'),
        hard: t('flagHard')
    }
    const flagLabel = props.media.flag ? (flagLabels[props.media.flag] ?? props.media.flag) : undefined

    return (
        <div
            style={{
                overflow: 'hidden',
                borderRadius: CssVar.round(2),
                aspectRatio: '4/3',
                flexShrink: 0,
                position: 'relative',
                cursor: 'pointer'
            }}
            onClick={(e) => {
                e.stopPropagation()
                if (hidden) {
                    sessionStorage.setItem('reveal:' + props.media.mediaURL, 'true')
                    setRevealed(true)
                } else {
                    props.onClick?.()
                }
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
            {/* 解除するまで実URLはDOMに出さない */}
            {!hidden && (
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
            )}
            {hidden && (
                <div
                    style={{
                        position: 'absolute',
                        top: '50%',
                        left: '50%',
                        transform: 'translate(-50%, -50%)',
                        width: '100%',
                        textAlign: 'center',
                        color: 'rgba(255, 255, 255, 0.7)',
                        pointerEvents: 'none',
                        userSelect: 'none'
                    }}
                >
                    <Text variant="h3" style={{ margin: 0, color: 'inherit' }}>
                        {flagLabel}
                    </Text>
                    <Text variant="caption" style={{ margin: 0, color: 'inherit' }}>
                        {t('clickToReveal')}
                    </Text>
                </div>
            )}
            {props.media.flag && !hidden && (
                <IconButton
                    title={t('hideAgain')}
                    onClick={(e) => {
                        e.stopPropagation()
                        sessionStorage.removeItem('reveal:' + props.media.mediaURL)
                        setRevealed(false)
                    }}
                    style={{
                        position: 'absolute',
                        bottom: '4px',
                        right: '4px',
                        color: 'rgba(255, 255, 255, 0.6)',
                        zIndex: 1
                    }}
                >
                    <MdVisibilityOff size={20} />
                </IconButton>
            )}
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
