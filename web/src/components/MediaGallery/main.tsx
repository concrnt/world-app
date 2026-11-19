import { useState } from 'react'
import type { CSSProperties } from 'react'
import { useTranslation } from 'react-i18next'
import { CCImage, CssVar, HorizontalLayout, IconButton, Text } from '@concrnt/ui'
import { MediaMessageSchema } from '@concrnt/worldlib'
import { GalleryImage } from './Image'
import { GalleryVideo } from './Video'
import { GalleryAudio } from './Audio'
import { GalleryModel } from './Model'
import { Blurhash } from 'react-blurhash'
import { MdVisibilityOff } from 'react-icons/md'
import { useMediaViewer } from '../../contexts/MediaViewer'

// aspectRatio は Bluesky の HLS 動画用(variant 切替で固有サイズが変わってもビューアの寸法を固定する)
export type Media = NonNullable<MediaMessageSchema['medias']>[number] & {
    aspectRatio?: { width: number; height: number }
}

interface Props {
    medias: Media[]
    // メディアを含む投稿のURI。ビューアの投稿パネル/ドロワーで使う
    messageURI?: string
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
                <MediaTile
                    key={index}
                    media={media}
                    playable
                    onClick={() => {
                        mediaViewer.open(
                            props.medias.map((m) => ({ ...m, messageURI: props.messageURI })),
                            index
                        )
                    }}
                />
            ))}
        </HorizontalLayout>
    )
}

export const MediaTile = (props: {
    media: Media
    onClick?: () => void
    style?: CSSProperties
    objectFit?: 'contain' | 'cover'
    // 動画をタイル内で再生する(onClick は拡大ボタンに回る)。メディアグリッドのような一覧では使わない
    playable?: boolean
}) => {
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
    const isVideo =
        props.media.mediaType.startsWith('video/') || props.media.mediaType === 'application/vnd.apple.mpegurl'
    // インライン再生中はネイティブコントロールが下端に出るので「再度隠す」は上端に逃がす(右上は拡大ボタン)
    const inlineVideo = !!props.playable && isVideo

    return (
        <div
            style={{
                overflow: 'hidden',
                borderRadius: CssVar.round(2),
                aspectRatio: '4/3',
                flexShrink: 0,
                position: 'relative',
                cursor: 'pointer',
                ...props.style
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
                {props.media.blurhash ? (
                    <Blurhash
                        hash={props.media.blurhash}
                        height={'100%'}
                        width={'100%'}
                        punch={1}
                        resolutionX={32}
                        resolutionY={32}
                    />
                ) : (
                    hidden &&
                    props.media.mediaType.startsWith('image/') && (
                        // blurhashが無い(AP/Bluesky由来に多い)画像は真っ黒にせず実画像をCSSブラーで敷く。
                        // 縮小取得+scaleでブラー端の透け(edge bleed)を隠す。altは出さない
                        <CCImage
                            src={props.media.mediaURL}
                            maxWidth={64}
                            alt=""
                            style={{
                                width: '100%',
                                height: '100%',
                                objectFit: 'cover',
                                filter: 'blur(24px)',
                                transform: 'scale(1.2)',
                                pointerEvents: 'none',
                                userSelect: 'none'
                            }}
                        />
                    )
                )}
            </div>
            {/* 解除するまで実URLはDOMに出さない(blurhash無し画像のブラー背景は例外) */}
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
                    <MediaBody
                        media={props.media}
                        objectFit={props.objectFit}
                        onExpand={inlineVideo ? props.onClick : undefined}
                    />
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
                    style={
                        inlineVideo
                            ? {
                                  position: 'absolute',
                                  top: '4px',
                                  left: '4px',
                                  color: 'rgba(255, 255, 255, 0.8)',
                                  backgroundColor: 'rgba(0, 0, 0, 0.4)'
                              }
                            : {
                                  position: 'absolute',
                                  bottom: '4px',
                                  right: '4px',
                                  color: 'rgba(255, 255, 255, 0.6)'
                              }
                    }
                >
                    <MdVisibilityOff size={20} />
                </IconButton>
            )}
        </div>
    )
}

const MediaBody = (props: { media: Media; objectFit?: 'contain' | 'cover'; onExpand?: () => void }) => {
    const kind =
        props.media.mediaType === 'application/vnd.apple.mpegurl' ? 'video' : props.media.mediaType.split('/')[0]
    switch (kind) {
        case 'image':
            return <GalleryImage media={props.media} objectFit={props.objectFit} />
        case 'video':
            return <GalleryVideo media={props.media} objectFit={props.objectFit} onExpand={props.onExpand} />
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
