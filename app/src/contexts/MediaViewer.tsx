import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { motion, useMotionValue, useTransform } from 'motion/react'
import { animate } from 'motion'

import { MdClose } from 'react-icons/md'

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

const SWIPE_X_THRESHOLD = 50
const SWIPE_Y_THRESHOLD = 120
const DOUBLE_TAP_DELAY = 300
const DOUBLE_TAP_ZOOM = 2.5
const MIN_SCALE = 1
const MAX_SCALE = 5
const IMAGE_GAP = 5
const ANIM_CONFIG = { type: 'tween' as const, ease: 'easeOut' as const, duration: 0.25 }

type GestureType = 'none' | 'swipe-x' | 'swipe-y' | 'pan' | 'pinch'

interface GestureRef {
    gestureType: GestureType
    startX: number
    startY: number
    startPanX: number
    startPanY: number
    startScale: number
    lastPinchDist: number
    pinchMidX: number
    pinchMidY: number
    lastTapTime: number
    lastTapX: number
    lastTapY: number
}

const getDistance = (t1: React.Touch, t2: React.Touch) => Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY)

const getMidpoint = (t1: React.Touch, t2: React.Touch) => ({
    x: (t1.clientX + t2.clientX) / 2,
    y: (t1.clientY + t2.clientY) / 2
})

export const MediaViewerProvider = (props: Props) => {
    const [medias, setMedias] = useState<MediaItem[]>([])
    const [currentIndex, setCurrentIndex] = useState(0)
    const isOpen = medias.length > 0

    // --- motion values ---
    // カルーセル全体のオフセット（横スワイプ / 縦スワイプ）
    const mvOffsetX = useMotionValue(0)
    const mvOffsetY = useMotionValue(0)

    // 現在の画像のズーム・パン
    const mvScale = useMotionValue(1)
    const mvPanX = useMotionValue(0)
    const mvPanY = useMotionValue(0)

    // --- 派生値 ---
    const bgColor = useTransform(mvOffsetY, (oy) => {
        const progress = Math.min(Math.abs(oy) / (SWIPE_Y_THRESHOLD * 1.5), 1)
        const opacity = 0.9 * (1 - progress * 0.5)
        return `rgba(0, 0, 0, ${opacity})`
    })

    const contentOpacity = useTransform(mvOffsetY, (oy) => {
        const progress = Math.min(Math.abs(oy) / (SWIPE_Y_THRESHOLD * 1.5), 1)
        return 1 - progress * 0.3
    })

    const imgRef = useRef<HTMLImageElement>(null)

    const clampPan = useCallback((px: number, py: number, s: number): { x: number; y: number } => {
        const img = imgRef.current
        if (!img || s <= 1) return { x: 0, y: 0 }

        const imgW = img.offsetWidth
        const imgH = img.offsetHeight
        const vpW = window.innerWidth
        const vpH = window.innerHeight

        const maxPanX = Math.max(0, (imgW * s - vpW) / 2)
        const maxPanY = Math.max(0, (imgH * s - vpH) / 2)

        return {
            x: Math.min(maxPanX, Math.max(-maxPanX, px)),
            y: Math.min(maxPanY, Math.max(-maxPanY, py))
        }
    }, [])

    const gestureRef = useRef<GestureRef>({
        gestureType: 'none',
        startX: 0,
        startY: 0,
        startPanX: 0,
        startPanY: 0,
        startScale: 1,
        lastPinchDist: 0,
        pinchMidX: 0,
        pinchMidY: 0,
        lastTapTime: 0,
        lastTapX: 0,
        lastTapY: 0
    })

    const stateRef = useRef({ currentIndex: 0, mediasLength: 0 })
    stateRef.current = { currentIndex, mediasLength: medias.length }

    // 1ページ分のスライド幅（画面幅 + 画像間ギャップ）
    const getPageWidth = useCallback(() => window.innerWidth + IMAGE_GAP, [])

    const resetMotion = useCallback(() => {
        mvOffsetX.set(0)
        mvOffsetY.set(0)
        mvScale.set(1)
        mvPanX.set(0)
        mvPanY.set(0)
    }, [mvOffsetX, mvOffsetY, mvScale, mvPanX, mvPanY])

    const open = useCallback(
        (medias: MediaItem[], startIndex?: number) => {
            resetMotion()
            setMedias(medias)
            setCurrentIndex(startIndex ?? 0)
        },
        [resetMotion]
    )

    const close = useCallback(() => {
        setMedias([])
        setCurrentIndex(0)
        resetMotion()
    }, [resetMotion])

    const changeImage = useCallback(
        (newIndex: number) => {
            setCurrentIndex(newIndex)
            mvOffsetX.set(0)
            mvScale.set(1)
            mvPanX.set(0)
            mvPanY.set(0)
        },
        [mvOffsetX, mvScale, mvPanX, mvPanY]
    )

    // --- ダブルタップ処理 ---
    const handleDoubleTap = useCallback(
        (clientX: number, clientY: number) => {
            const currentScale = mvScale.get()
            if (currentScale > 1) {
                animate(mvScale, 1, ANIM_CONFIG)
                animate(mvPanX, 0, ANIM_CONFIG)
                animate(mvPanY, 0, ANIM_CONFIG)
            } else {
                const centerX = window.innerWidth / 2
                const centerY = window.innerHeight / 2
                const newPanX = (centerX - clientX) * (DOUBLE_TAP_ZOOM - 1)
                const newPanY = (centerY - clientY) * (DOUBLE_TAP_ZOOM - 1)
                const clamped = clampPan(newPanX, newPanY, DOUBLE_TAP_ZOOM)
                animate(mvScale, DOUBLE_TAP_ZOOM, ANIM_CONFIG)
                animate(mvPanX, clamped.x, ANIM_CONFIG)
                animate(mvPanY, clamped.y, ANIM_CONFIG)
            }
        },
        [mvScale, mvPanX, mvPanY, clampPan]
    )

    // --- タッチイベント ---
    const handleTouchStart = useCallback(
        (e: React.TouchEvent) => {
            const g = gestureRef.current

            if (e.touches.length === 2) {
                g.gestureType = 'pinch'
                g.lastPinchDist = getDistance(e.touches[0], e.touches[1])
                const mid = getMidpoint(e.touches[0], e.touches[1])
                g.pinchMidX = mid.x
                g.pinchMidY = mid.y
                g.startScale = mvScale.get()
                g.startPanX = mvPanX.get()
                g.startPanY = mvPanY.get()
                return
            }

            if (e.touches.length === 1) {
                const touch = e.touches[0]
                g.gestureType = 'none'
                g.startX = touch.clientX
                g.startY = touch.clientY
                g.startPanX = mvPanX.get()
                g.startPanY = mvPanY.get()
            }
        },
        [mvScale, mvPanX, mvPanY]
    )

    const handleTouchMove = useCallback(
        (e: React.TouchEvent) => {
            const g = gestureRef.current

            if (e.touches.length === 2 && g.gestureType === 'pinch') {
                const newDist = getDistance(e.touches[0], e.touches[1])
                const ratio = newDist / g.lastPinchDist
                const newScale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, g.startScale * ratio))

                const centerX = window.innerWidth / 2
                const centerY = window.innerHeight / 2
                const focalX = g.pinchMidX - centerX
                const focalY = g.pinchMidY - centerY
                const scaleChange = newScale / g.startScale
                const newPanX = g.startPanX - focalX * (scaleChange - 1)
                const newPanY = g.startPanY - focalY * (scaleChange - 1)

                const clamped = clampPan(newPanX, newPanY, newScale)
                mvScale.set(newScale)
                mvPanX.set(clamped.x)
                mvPanY.set(clamped.y)
                return
            }

            if (e.touches.length !== 1) return
            if (g.gestureType === 'pinch') return

            const touch = e.touches[0]
            const dx = touch.clientX - g.startX
            const dy = touch.clientY - g.startY

            if (mvScale.get() > 1) {
                g.gestureType = 'pan'
                const clamped = clampPan(g.startPanX + dx, g.startPanY + dy, mvScale.get())
                mvPanX.set(clamped.x)
                mvPanY.set(clamped.y)
                return
            }

            // 等倍時 → ジェスチャー方向を判定
            if (g.gestureType === 'none') {
                if (Math.abs(dx) > 8 || Math.abs(dy) > 8) {
                    g.gestureType = Math.abs(dx) > Math.abs(dy) ? 'swipe-x' : 'swipe-y'
                } else {
                    return
                }
            }

            if (g.gestureType === 'swipe-x') {
                const s = stateRef.current
                let clampedDx = dx
                if ((s.currentIndex === 0 && dx > 0) || (s.currentIndex === s.mediasLength - 1 && dx < 0)) {
                    clampedDx = dx * 0.3
                }
                if (s.mediasLength <= 1) {
                    clampedDx = dx * 0.3
                }
                mvOffsetX.set(clampedDx)
            } else if (g.gestureType === 'swipe-y') {
                mvOffsetY.set(dy)
            }
        },
        [mvScale, mvPanX, mvPanY, mvOffsetX, mvOffsetY, clampPan]
    )

    const handleTouchEnd = useCallback(
        (e: React.TouchEvent) => {
            const g = gestureRef.current
            const s = stateRef.current

            // ピンチ終了
            if (g.gestureType === 'pinch') {
                if (e.touches.length === 0) {
                    g.gestureType = 'none'
                    const currentScale = mvScale.get()
                    if (currentScale <= 1) {
                        animate(mvScale, 1, ANIM_CONFIG)
                        animate(mvPanX, 0, ANIM_CONFIG)
                        animate(mvPanY, 0, ANIM_CONFIG)
                    } else {
                        const clamped = clampPan(mvPanX.get(), mvPanY.get(), currentScale)
                        animate(mvPanX, clamped.x, ANIM_CONFIG)
                        animate(mvPanY, clamped.y, ANIM_CONFIG)
                    }
                }
                return
            }

            if (e.touches.length > 0) return

            const now = Date.now()
            const touch = e.changedTouches[0]

            // タップ判定
            if (g.gestureType === 'none') {
                const timeDiff = now - g.lastTapTime
                const distDiff = Math.hypot(touch.clientX - g.lastTapX, touch.clientY - g.lastTapY)

                if (timeDiff < DOUBLE_TAP_DELAY && distDiff < 30) {
                    g.lastTapTime = 0
                    handleDoubleTap(touch.clientX, touch.clientY)
                } else {
                    g.lastTapTime = now
                    g.lastTapX = touch.clientX
                    g.lastTapY = touch.clientY
                }
                return
            }

            if (g.gestureType === 'swipe-x') {
                // 横スワイプ完了 — ページ幅分スライドして画像切り替え
                const currentOX = mvOffsetX.get()
                const pw = getPageWidth()

                if (currentOX < -SWIPE_X_THRESHOLD && s.currentIndex < s.mediasLength - 1) {
                    // 次の画像へ: 左にページ幅分スライド → インデックス更新 → リセット
                    animate(mvOffsetX, -pw, {
                        ...ANIM_CONFIG,
                        onComplete: () => {
                            setCurrentIndex(s.currentIndex + 1)
                            mvScale.set(1)
                            mvPanX.set(0)
                            mvPanY.set(0)
                            mvOffsetX.set(0)
                        }
                    })
                } else if (currentOX > SWIPE_X_THRESHOLD && s.currentIndex > 0) {
                    // 前の画像へ: 右にページ幅分スライド → インデックス更新 → リセット
                    animate(mvOffsetX, pw, {
                        ...ANIM_CONFIG,
                        onComplete: () => {
                            setCurrentIndex(s.currentIndex - 1)
                            mvScale.set(1)
                            mvPanX.set(0)
                            mvPanY.set(0)
                            mvOffsetX.set(0)
                        }
                    })
                } else {
                    animate(mvOffsetX, 0, ANIM_CONFIG)
                }
            } else if (g.gestureType === 'swipe-y') {
                const currentOY = mvOffsetY.get()
                if (Math.abs(currentOY) > SWIPE_Y_THRESHOLD) {
                    close()
                } else {
                    animate(mvOffsetY, 0, ANIM_CONFIG)
                }
            }

            g.gestureType = 'none'
        },
        [mvOffsetX, mvOffsetY, mvScale, mvPanX, mvPanY, clampPan, handleDoubleTap, close, getPageWidth]
    )

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

    useEffect(() => {
        gestureRef.current.gestureType = 'none'
    }, [currentIndex])

    const currentMedia = medias[currentIndex]
    const prevMedia = currentIndex > 0 ? medias[currentIndex - 1] : null
    const nextMedia = currentIndex < medias.length - 1 ? medias[currentIndex + 1] : null

    const value = useMemo(() => ({ open }), [open])

    return (
        <MediaViewerContext.Provider value={value}>
            {props.children}

            {isOpen && currentMedia && (
                <motion.div
                    style={{
                        position: 'fixed',
                        top: 0,
                        left: 0,
                        width: '100vw',
                        height: '100dvh',
                        backgroundColor: bgColor,
                        zIndex: 9999,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        overflow: 'hidden',
                        touchAction: 'none'
                    }}
                    onClick={(e) => {
                        if (e.target === e.currentTarget) close()
                    }}
                >
                    {/* カルーセル: 前・現在・次 の画像を横並び */}
                    <motion.div
                        style={{
                            display: 'flex',
                            flexDirection: 'row',
                            alignItems: 'center',
                            width: '100%',
                            height: '100%',
                            x: mvOffsetX,
                            y: mvOffsetY,
                            opacity: contentOpacity,
                            gap: `${IMAGE_GAP}px`
                        }}
                        onTouchStart={handleTouchStart}
                        onTouchMove={handleTouchMove}
                        onTouchEnd={handleTouchEnd}
                    >
                        {/* 前の画像 */}
                        <div
                            style={{
                                flexShrink: 0,
                                width: '100vw',
                                height: '100%',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                marginLeft: `calc(-100vw - ${IMAGE_GAP}px)`
                            }}
                        >
                            {prevMedia && prevMedia.mediaType.startsWith('image/') && (
                                <img
                                    src={prevMedia.mediaURL}
                                    alt={prevMedia.altText ?? ''}
                                    style={{
                                        maxWidth: '90vw',
                                        maxHeight: '85dvh',
                                        objectFit: 'contain',
                                        userSelect: 'none',
                                        pointerEvents: 'none'
                                    }}
                                    draggable={false}
                                />
                            )}
                        </div>

                        {/* 現在の画像（ズーム・パン対応） */}
                        <div
                            style={{
                                flexShrink: 0,
                                width: '100vw',
                                height: '100%',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                            }}
                        >
                            {currentMedia.mediaType.startsWith('image/') ? (
                                <motion.img
                                    src={currentMedia.mediaURL}
                                    alt={currentMedia.altText ?? ''}
                                    style={{
                                        maxWidth: '90vw',
                                        maxHeight: '85dvh',
                                        objectFit: 'contain',
                                        userSelect: 'none',
                                        pointerEvents: 'auto',
                                        scale: mvScale,
                                        x: mvPanX,
                                        y: mvPanY,
                                        transformOrigin: 'center center'
                                    }}
                                    draggable={false}
                                    ref={imgRef}
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

                        {/* 次の画像 */}
                        <div
                            style={{
                                flexShrink: 0,
                                width: '100vw',
                                height: '100%',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                            }}
                        >
                            {nextMedia && nextMedia.mediaType.startsWith('image/') && (
                                <img
                                    src={nextMedia.mediaURL}
                                    alt={nextMedia.altText ?? ''}
                                    style={{
                                        maxWidth: '90vw',
                                        maxHeight: '85dvh',
                                        objectFit: 'contain',
                                        userSelect: 'none',
                                        pointerEvents: 'none'
                                    }}
                                    draggable={false}
                                />
                            )}
                        </div>
                    </motion.div>

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
                                        changeImage(index)
                                    }}
                                />
                            ))}
                        </div>
                    )}
                </motion.div>
            )}
        </MediaViewerContext.Provider>
    )
}

export const useMediaViewer = (): MediaViewerState => {
    return useContext(MediaViewerContext)
}
