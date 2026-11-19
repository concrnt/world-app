import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { IconButton } from '@concrnt/ui'
import { Media } from './main'
import { HlsVideo } from '../HlsVideo'
import { MdFullscreen, MdPlayCircle } from 'react-icons/md'

// onExpand があればインライン再生モード: ポスターをタップするとその場に <video> を差し込んで再生し、
// 右上の拡大ボタンでビューアへ移す。無ければポスターだけ描き、タップはタイル側(ビューアを開く)に任せる
export const GalleryVideo = ({
    media,
    objectFit,
    onExpand
}: {
    media: Media
    objectFit?: 'contain' | 'cover'
    onExpand?: () => void
}) => {
    const { t } = useTranslation('', { keyPrefix: 'components.mediaGallery' })
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const [playing, setPlaying] = useState(false)

    useEffect(() => {
        if (playing || media.thumbnailURL || media.mediaType === 'application/vnd.apple.mpegurl') return
        const canvas = canvasRef.current
        if (!canvas) return
        const context = canvas.getContext('2d')
        if (!context) return
        canvas.width = 0
        canvas.height = 0
        const video = document.createElement('video')
        const release = () => {
            video.onloadeddata = null
            video.onerror = null
            video.pause()
            video.removeAttribute('src')
            video.load()
        }
        video.onloadeddata = () => {
            try {
                canvas.width = video.videoWidth
                canvas.height = video.videoHeight
                context.drawImage(video, 0, 0)
            } finally {
                release()
            }
        }
        video.onerror = release
        video.muted = true
        video.playsInline = true
        video.preload = 'auto'
        video.src = media.mediaURL
        // iOSでも最初のフレームをデコードする。取得後はすぐに停止する。
        // loadeddataで停止した場合にもplay()はrejectされる。
        void video.play().catch(() => {})
        return release
    }, [playing, media.mediaURL, media.thumbnailURL, media.mediaType])

    return (
        <div
            style={{
                position: 'relative',
                width: '100%',
                height: '100%',
                cursor: 'pointer'
            }}
        >
            {playing ? (
                <HlsVideo
                    src={media.mediaURL}
                    poster={media.thumbnailURL}
                    controls
                    autoPlay
                    playsInline
                    aria-label={media.altText}
                    style={{
                        display: 'block',
                        width: '100%',
                        height: '100%',
                        objectFit: objectFit ?? 'contain',
                        backgroundColor: '#000'
                    }}
                    onClick={(e) => e.stopPropagation()}
                />
            ) : (
                <>
                    {media.thumbnailURL ? (
                        <img
                            src={media.thumbnailURL}
                            alt={media.altText ?? ''}
                            style={{
                                width: '100%',
                                height: '100%',
                                objectFit: objectFit ?? 'contain',
                                pointerEvents: 'none'
                            }}
                        />
                    ) : (
                        <canvas
                            ref={canvasRef}
                            role="img"
                            aria-label={media.altText}
                            style={{
                                width: '100%',
                                height: '100%',
                                objectFit: objectFit ?? 'contain',
                                pointerEvents: 'none'
                            }}
                        />
                    )}
                    <div
                        role={onExpand ? 'button' : undefined}
                        aria-label={onExpand ? t('play') : undefined}
                        style={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            width: '100%',
                            height: '100%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            pointerEvents: onExpand ? 'auto' : 'none'
                        }}
                        onClick={
                            onExpand
                                ? (e) => {
                                      e.stopPropagation()
                                      setPlaying(true)
                                  }
                                : undefined
                        }
                    >
                        <MdPlayCircle size={48} style={{ color: 'rgba(255, 255, 255, 0.8)' }} />
                    </div>
                </>
            )}
            {onExpand && (
                <IconButton
                    title={t('expand')}
                    onClick={(e) => {
                        e.stopPropagation()
                        // 再生はビューア側に引き継ぐ。戻ってきたらポスターから
                        setPlaying(false)
                        onExpand()
                    }}
                    style={{
                        position: 'absolute',
                        top: '4px',
                        right: '4px',
                        color: 'rgba(255, 255, 255, 0.8)',
                        backgroundColor: 'rgba(0, 0, 0, 0.4)'
                    }}
                >
                    <MdFullscreen size={20} />
                </IconButton>
            )}
        </div>
    )
}
