import { useEffect, useRef } from 'react'
import { Media } from './main'
import { MdPlayCircle } from 'react-icons/md'

export const GalleryVideo = ({ media }: { media: Media }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null)

    useEffect(() => {
        if (media.thumbnailURL) return
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
    }, [media.mediaURL, media.thumbnailURL])

    return (
        <div
            style={{
                position: 'relative',
                width: '100%',
                height: '100%',
                cursor: 'pointer'
            }}
        >
            {media.thumbnailURL ? (
                <img
                    src={media.thumbnailURL}
                    alt={media.altText ?? ''}
                    style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'contain',
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
                        objectFit: 'contain',
                        pointerEvents: 'none'
                    }}
                />
            )}
            <div
                style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    pointerEvents: 'none'
                }}
            >
                <MdPlayCircle size={48} style={{ color: 'rgba(255, 255, 255, 0.8)' }} />
            </div>
        </div>
    )
}
