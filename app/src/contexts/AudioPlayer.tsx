import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { MdPlayArrow, MdPause, MdClose, MdMusicNote } from 'react-icons/md'
import { CssVar } from '../types/Theme'

export interface AudioPlayerState {
    nowPlaying: string | null
    play: (src: string) => void
    stop: () => void
}

const AudioPlayerContext = createContext<AudioPlayerState>({
    nowPlaying: null,
    play: () => {},
    stop: () => {}
})

interface Props {
    children: React.ReactNode
}

const formatTime = (seconds: number): string => {
    const safe = Number.isFinite(seconds) && seconds > 0 ? Math.floor(seconds) : 0
    const m = Math.floor(safe / 60)
    const s = safe % 60
    return `${m}:${String(s).padStart(2, '0')}`
}

export const AudioPlayerProvider = (props: Props) => {
    const audioRef = useRef<HTMLAudioElement | null>(null)
    const [src, setSrc] = useState<string | null>(null)
    const [isPlaying, setIsPlaying] = useState(false)
    const [duration, setDuration] = useState(0)
    const [currentTime, setCurrentTime] = useState(0)

    useEffect(() => {
        const audio = new Audio()
        audio.preload = 'metadata'
        audioRef.current = audio

        const onPlay = () => setIsPlaying(true)
        const onPause = () => setIsPlaying(false)
        const onEnded = () => {
            setIsPlaying(false)
            setCurrentTime(0)
        }
        const onLoadedMetadata = () => {
            if (Number.isFinite(audio.duration)) {
                setDuration(audio.duration)
            }
        }
        const onDurationChange = () => {
            if (Number.isFinite(audio.duration)) {
                setDuration(audio.duration)
            }
        }
        const onTimeUpdate = () => {
            setCurrentTime(audio.currentTime)
        }

        audio.addEventListener('play', onPlay)
        audio.addEventListener('pause', onPause)
        audio.addEventListener('ended', onEnded)
        audio.addEventListener('loadedmetadata', onLoadedMetadata)
        audio.addEventListener('durationchange', onDurationChange)
        audio.addEventListener('timeupdate', onTimeUpdate)

        return () => {
            audio.removeEventListener('play', onPlay)
            audio.removeEventListener('pause', onPause)
            audio.removeEventListener('ended', onEnded)
            audio.removeEventListener('loadedmetadata', onLoadedMetadata)
            audio.removeEventListener('durationchange', onDurationChange)
            audio.removeEventListener('timeupdate', onTimeUpdate)
            audio.pause()
            audio.removeAttribute('src')
            audio.load()
        }
    }, [])

    const play = useCallback(
        (nextSrc: string) => {
            const audio = audioRef.current
            if (!audio) return

            if (src === nextSrc) {
                if (isPlaying) {
                    audio.pause()
                } else {
                    void audio.play()
                }
                return
            }

            audio.src = nextSrc
            audio.currentTime = 0
            setCurrentTime(0)
            setDuration(0)
            setSrc(nextSrc)
            void audio.play().catch(() => setIsPlaying(false))
        },
        [src, isPlaying]
    )

    const stop = useCallback(() => {
        const audio = audioRef.current
        if (audio) {
            audio.pause()
            audio.removeAttribute('src')
            audio.load()
        }
        setSrc(null)
        setIsPlaying(false)
        setCurrentTime(0)
        setDuration(0)
    }, [])

    const togglePlay = useCallback(() => {
        const audio = audioRef.current
        if (!audio || !src) return
        if (isPlaying) {
            audio.pause()
        } else {
            void audio.play()
        }
    }, [src, isPlaying])

    const handleSeek = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const audio = audioRef.current
        if (!audio) return
        const time = Number(e.target.value)
        audio.currentTime = time
        setCurrentTime(time)
    }, [])

    const value = useMemo(() => ({ nowPlaying: src, play, stop }), [src, play, stop])

    return (
        <AudioPlayerContext.Provider value={value}>
            {props.children}

            {src && (
                <div
                    style={{
                        position: 'fixed',
                        bottom: 'calc(52px + env(safe-area-inset-bottom))',
                        left: 0,
                        right: 0,
                        zIndex: 9000,
                        padding: '0 8px'
                    }}
                >
                    <div
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            padding: '8px 12px',
                            borderRadius: '12px',
                            backgroundColor: CssVar.uiBackground,
                            color: CssVar.uiText,
                            boxShadow: '0 2px 12px rgba(0,0,0,0.25)'
                        }}
                    >
                        <button
                            onClick={togglePlay}
                            style={{
                                background: 'none',
                                border: 'none',
                                color: 'inherit',
                                padding: '4px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                cursor: 'pointer',
                                flexShrink: 0
                            }}
                        >
                            {isPlaying ? <MdPause size={24} /> : <MdPlayArrow size={24} />}
                        </button>

                        <MdMusicNote size={16} style={{ flexShrink: 0, opacity: 0.6 }} />

                        <span
                            style={{
                                fontSize: '12px',
                                fontVariantNumeric: 'tabular-nums',
                                flexShrink: 0,
                                minWidth: '32px',
                                textAlign: 'right'
                            }}
                        >
                            {formatTime(currentTime)}
                        </span>

                        <input
                            type="range"
                            min={0}
                            max={duration > 0 ? duration : 1}
                            value={Math.min(currentTime, duration > 0 ? duration : 1)}
                            onChange={handleSeek}
                            style={{
                                flex: 1,
                                height: '4px',
                                accentColor: CssVar.contentLink,
                                cursor: 'pointer'
                            }}
                        />

                        <span
                            style={{
                                fontSize: '12px',
                                fontVariantNumeric: 'tabular-nums',
                                flexShrink: 0,
                                minWidth: '32px'
                            }}
                        >
                            {formatTime(duration)}
                        </span>

                        <button
                            onClick={stop}
                            style={{
                                background: 'none',
                                border: 'none',
                                color: 'inherit',
                                padding: '4px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                cursor: 'pointer',
                                flexShrink: 0
                            }}
                        >
                            <MdClose size={20} />
                        </button>
                    </div>
                </div>
            )}
        </AudioPlayerContext.Provider>
    )
}

export const useAudioPlayer = (): AudioPlayerState => {
    return useContext(AudioPlayerContext)
}
