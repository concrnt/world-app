import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'

import { MdClose, MdChevronLeft, MdChevronRight } from 'react-icons/md'

export interface MediaItem {
    mediaURL: string
    mediaType: string
    thumbnailURL?: string
    altText?: string
}

interface MediaViewerState {
    open: (medias: MediaItem[], startIndex?: number) => void
}

const MediaViewerContext = createContext<MediaViewerState>({
    open: () => {}
})

interface Props {
    children: React.ReactNode
}

const SWIPE_THRESHOLD = 50

export const MediaViewerProvider = (props: Props) => {
    const [medias, setMedias] = useState<MediaItem[]>([])
    const [currentIndex, setCurrentIndex] = useState(0)
    const isOpen = medias.length > 0

    // スワイプ状態
    const [offsetX, setOffsetX] = useState(0)
    const [isSwiping, setIsSwiping] = useState(false)
    const swipeRef = useRef({ startX: 0, startY: 0, tracking: false })

    const open = useCallback((medias: MediaItem[], startIndex?: number) => {
        setMedias(medias)
        setCurrentIndex(startIndex ?? 0)
    }, [])

    const close = useCallback(() => {
        setMedias([])
        setCurrentIndex(0)
        setOffsetX(0)
        setIsSwiping(false)
    }, [])

    const goNext = useCallback(() => {
        setCurrentIndex((prev) => Math.min(prev + 1, medias.length - 1))
    }, [medias.length])

    const goPrev = useCallback(() => {
        setCurrentIndex((prev) => Math.max(prev - 1, 0))
    }, [])

    // スワイプ完了処理
    const finishSwipe = useCallback(() => {
        if (offsetX < -SWIPE_THRESHOLD && currentIndex < medias.length - 1) {
            setCurrentIndex((prev) => prev + 1)
        } else if (offsetX > SWIPE_THRESHOLD && currentIndex > 0) {
            setCurrentIndex((prev) => prev - 1)
        }
        setOffsetX(0)
        setIsSwiping(false)
        swipeRef.current.tracking = false
    }, [offsetX, currentIndex, medias.length])

    // --- タッチイベント ---
    const handleTouchStart = useCallback(
        (e: React.TouchEvent) => {
            if (medias.length <= 1) return
            const touch = e.touches[0]
            swipeRef.current = { startX: touch.clientX, startY: touch.clientY, tracking: true }
            setIsSwiping(true)
        },
        [medias.length]
    )

    const handleTouchMove = useCallback(
        (e: React.TouchEvent) => {
            if (!swipeRef.current.tracking) return
            const touch = e.touches[0]
            const dx = touch.clientX - swipeRef.current.startX
            const dy = touch.clientY - swipeRef.current.startY

            // 縦方向のスワイプが大きい場合はトラッキングをやめる
            if (Math.abs(dy) > Math.abs(dx) && Math.abs(dx) < 10) {
                swipeRef.current.tracking = false
                setIsSwiping(false)
                setOffsetX(0)
                return
            }

            // 端でのラバーバンド効果（抵抗感）
            let clampedDx = dx
            if ((currentIndex === 0 && dx > 0) || (currentIndex === medias.length - 1 && dx < 0)) {
                clampedDx = dx * 0.3
            }
            setOffsetX(clampedDx)
        },
        [currentIndex, medias.length]
    )

    const handleTouchEnd = useCallback(() => {
        if (!swipeRef.current.tracking) return
        finishSwipe()
    }, [finishSwipe])

    // --- マウスイベント（デスクトップ対応） ---
    const handleMouseDown = useCallback(
        (e: React.MouseEvent) => {
            if (medias.length <= 1) return
            e.preventDefault()
            swipeRef.current = { startX: e.clientX, startY: e.clientY, tracking: true }
            setIsSwiping(true)
        },
        [medias.length]
    )

    useEffect(() => {
        if (!isSwiping) return

        const handleMouseMove = (e: MouseEvent) => {
            if (!swipeRef.current.tracking) return
            const dx = e.clientX - swipeRef.current.startX

            let clampedDx = dx
            if ((currentIndex === 0 && dx > 0) || (currentIndex === medias.length - 1 && dx < 0)) {
                clampedDx = dx * 0.3
            }
            setOffsetX(clampedDx)
        }

        const handleMouseUp = () => {
            if (!swipeRef.current.tracking) return
            finishSwipe()
        }

        window.addEventListener('mousemove', handleMouseMove)
        window.addEventListener('mouseup', handleMouseUp)
        return () => {
            window.removeEventListener('mousemove', handleMouseMove)
            window.removeEventListener('mouseup', handleMouseUp)
        }
    }, [isSwiping, currentIndex, medias.length, finishSwipe])

    // キーボード操作
    useEffect(() => {
        if (!isOpen) return

        const handleKeyDown = (e: KeyboardEvent) => {
            switch (e.key) {
                case 'Escape':
                    close()
                    break
                case 'ArrowLeft':
                    goPrev()
                    break
                case 'ArrowRight':
                    goNext()
                    break
            }
        }

        window.addEventListener('keydown', handleKeyDown)
        return () => window.removeEventListener('keydown', handleKeyDown)
    }, [isOpen, close, goNext, goPrev])

    // スクロール抑制
    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden'
        } else {
            document.body.style.overflow = ''
        }
        return () => {
            document.body.style.overflow = ''
        }
    }, [isOpen])

    const currentMedia = medias[currentIndex]

    const value = useMemo(() => ({ open }), [open])

    return (
        <MediaViewerContext.Provider value={value}>
            {props.children}

            {isOpen && currentMedia && (
                <div
                    style={{
                        position: 'fixed',
                        top: 0,
                        left: 0,
                        width: '100vw',
                        height: '100dvh',
                        backgroundColor: 'rgba(0, 0, 0, 0.9)',
                        zIndex: 9999,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        overflow: 'hidden',
                        touchAction: 'none'
                    }}
                    onClick={(e) => {
                        // スワイプ操作中のクリックは無視
                        if (Math.abs(offsetX) > 5) return
                        // 背景（自分自身）を直接タップした場合のみ閉じる
                        if (e.target === e.currentTarget) close()
                    }}
                >
                    {/* スワイプ領域 */}
                    <div
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            width: '100%',
                            height: '100%',
                            transform: `translateX(${offsetX}px)`,
                            transition: isSwiping ? 'none' : 'transform 0.25s ease-out',
                            cursor: medias.length > 1 ? 'grab' : 'default',
                            willChange: 'transform'
                        }}
                        onTouchStart={handleTouchStart}
                        onTouchMove={handleTouchMove}
                        onTouchEnd={handleTouchEnd}
                        onMouseDown={handleMouseDown}
                    >
                        {/* メイン画像 */}
                        {currentMedia.mediaType.startsWith('image/') ? (
                            <img
                                src={currentMedia.mediaURL}
                                alt={currentMedia.altText ?? ''}
                                style={{
                                    maxWidth: '90vw',
                                    maxHeight: '85dvh',
                                    objectFit: 'contain',
                                    userSelect: 'none',
                                    pointerEvents: 'auto'
                                }}
                                draggable={false}
                            />
                        ) : currentMedia.mediaType.startsWith('video/') ? (
                            <video
                                src={currentMedia.mediaURL}
                                controls
                                autoPlay
                                style={{
                                    maxWidth: '90vw',
                                    maxHeight: '85dvh'
                                }}
                                onClick={(e) => e.stopPropagation()}
                            />
                        ) : null}
                    </div>

                    {/* 閉じるボタン */}
                    <button
                        onClick={(e) => {
                            e.stopPropagation()
                            close()
                        }}
                        style={{
                            position: 'absolute',
                            top: 'max(12px, env(safe-area-inset-top))',
                            right: '12px',
                            background: 'rgba(255, 255, 255, 0.15)',
                            border: 'none',
                            borderRadius: '50%',
                            width: '40px',
                            height: '40px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer',
                            color: 'white'
                        }}
                    >
                        <MdClose size={24} />
                    </button>

                    {/* 左矢印 */}
                    {medias.length > 1 && currentIndex > 0 && (
                        <button
                            onClick={(e) => {
                                e.stopPropagation()
                                goPrev()
                            }}
                            style={{
                                position: 'absolute',
                                top: '50%',
                                left: '8px',
                                transform: 'translateY(-50%)',
                                background: 'rgba(255, 255, 255, 0.15)',
                                border: 'none',
                                borderRadius: '50%',
                                width: '44px',
                                height: '44px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                cursor: 'pointer',
                                color: 'white'
                            }}
                        >
                            <MdChevronLeft size={28} />
                        </button>
                    )}

                    {/* 右矢印 */}
                    {medias.length > 1 && currentIndex < medias.length - 1 && (
                        <button
                            onClick={(e) => {
                                e.stopPropagation()
                                goNext()
                            }}
                            style={{
                                position: 'absolute',
                                top: '50%',
                                right: '8px',
                                transform: 'translateY(-50%)',
                                background: 'rgba(255, 255, 255, 0.15)',
                                border: 'none',
                                borderRadius: '50%',
                                width: '44px',
                                height: '44px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                cursor: 'pointer',
                                color: 'white'
                            }}
                        >
                            <MdChevronRight size={28} />
                        </button>
                    )}

                    {/* ページインジケーター */}
                    {medias.length > 1 && (
                        <div
                            style={{
                                position: 'absolute',
                                bottom: 'max(16px, env(safe-area-inset-bottom))',
                                left: '50%',
                                transform: 'translateX(-50%)',
                                display: 'flex',
                                gap: '6px',
                                alignItems: 'center'
                            }}
                        >
                            {medias.map((_, index) => (
                                <div
                                    key={index}
                                    style={{
                                        width: index === currentIndex ? '10px' : '7px',
                                        height: index === currentIndex ? '10px' : '7px',
                                        borderRadius: '50%',
                                        backgroundColor: index === currentIndex ? 'white' : 'rgba(255, 255, 255, 0.4)',
                                        transition: 'all 0.2s ease',
                                        cursor: 'pointer'
                                    }}
                                    onClick={(e) => {
                                        e.stopPropagation()
                                        setCurrentIndex(index)
                                    }}
                                />
                            ))}
                        </div>
                    )}
                </div>
            )}
        </MediaViewerContext.Provider>
    )
}

export const useMediaViewer = (): MediaViewerState => {
    return useContext(MediaViewerContext)
}
