import { useEffect, useRef } from 'react'
import type { ComponentProps } from 'react'
import type Hls from 'hls.js'

const isHlsUrl = (src: string): boolean => {
    try {
        return new URL(src, location.href).pathname.endsWith('.m3u8')
    } catch {
        return false
    }
}

// iOS/iPadOS だけ AVFoundation のネイティブ再生(iPadOS は UA が Macintosh なので touch で判別)。
// canPlayType('application/vnd.apple.mpegurl') は Chrome でも 'maybe' を返すのに実際は再生できないので判定に使えない
const preferNative =
    /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)

// <video> に HLS(m3u8)再生を足したもの。m3u8 以外の src はそのまま <video src> に渡す
export const HlsVideo = ({ src, ...rest }: ComponentProps<'video'> & { src: string }) => {
    const ref = useRef<HTMLVideoElement>(null)
    const hls = isHlsUrl(src)

    useEffect(() => {
        const video = ref.current
        if (!video || !hls) return
        if (preferNative) {
            video.src = src
            return () => {
                video.removeAttribute('src')
                video.load()
            }
        }
        let cancelled = false
        let player: Hls | undefined
        import('hls.js')
            .then(({ default: Hls }) => {
                if (cancelled) return
                if (!Hls.isSupported()) {
                    video.src = src
                    return
                }
                player = new Hls()
                player.on(Hls.Events.ERROR, (_event, data) => {
                    if (data.fatal) console.warn('hls.js fatal error', data.details)
                })
                player.loadSource(src)
                player.attachMedia(video)
            })
            .catch((e) => {
                console.warn('hls.js load failed, falling back to native src', e)
                if (!cancelled) video.src = src
            })
        return () => {
            cancelled = true
            player?.destroy()
            video.removeAttribute('src')
            video.load()
        }
    }, [src, hls])

    // HLS のときは src を属性に出さない(effect より先にネイティブロードが走って hls.js の blob: を潰す)
    return <video ref={ref} src={hls ? undefined : src} {...rest} />
}
