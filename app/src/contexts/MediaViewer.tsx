import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'

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
    tapTimeout: ReturnType<typeof setTimeout> | null
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

    // スワイプ（等倍時の画像切り替え/閉じる）
    const [offsetX, setOffsetX] = useState(0)
    const [offsetY, setOffsetY] = useState(0)
    const [isSwiping, setIsSwiping] = useState(false)

    // ズーム・パン
    const [scale, setScale] = useState(1)
    const [panX, setPanX] = useState(0)
    const [panY, setPanY] = useState(0)
    const [isPinching, setIsPinching] = useState(false)

    const imgRef = useRef<HTMLImageElement>(null)

    // パン範囲をクランプ（画像の端を超えないようにする）
    const clampPan = useCallback((px: number, py: number, s: number): { x: number; y: number } => {
        const img = imgRef.current
        if (!img || s <= 1) return { x: 0, y: 0 }

        // 画像の等倍時のレンダリングサイズ
        const imgW = img.offsetWidth
        const imgH = img.offsetHeight
        const vpW = window.innerWidth
        const vpH = window.innerHeight

        // ズームで画像がビューポートをはみ出す分だけパン可能
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
        lastTapY: 0,
        tapTimeout: null
    })

    // 現在のstateをrefで参照（コールバック内の最新値アクセス用）
    const stateRef = useRef({ scale: 1, panX: 0, panY: 0, currentIndex: 0, mediasLength: 0 })
    stateRef.current = { scale, panX, panY, currentIndex, mediasLength: medias.length }

    const open = useCallback((medias: MediaItem[], startIndex?: number) => {
        setMedias(medias)
        setCurrentIndex(startIndex ?? 0)
    }, [])

    const resetZoom = useCallback(() => {
        setScale(1)
        setPanX(0)
        setPanY(0)
    }, [])

    const close = useCallback(() => {
        setMedias([])
        setCurrentIndex(0)
        setOffsetX(0)
        setOffsetY(0)
        setIsSwiping(false)
        resetZoom()
    }, [resetZoom])

    // 画像切り替え時にズームをリセット
    const changeImage = useCallback(
        (newIndex: number) => {
            setCurrentIndex(newIndex)
            resetZoom()
        },
        [resetZoom]
    )

    // --- ダブルタップ処理 ---
    const handleDoubleTap = useCallback((clientX: number, clientY: number) => {
        const s = stateRef.current
        if (s.scale > 1) {
            // ズーム中 → 等倍に戻す
            setScale(1)
            setPanX(0)
            setPanY(0)
        } else {
            // 等倍 → タップ位置を中心に拡大
            const centerX = window.innerWidth / 2
            const centerY = window.innerHeight / 2
            const newPanX = (centerX - clientX) * (DOUBLE_TAP_ZOOM - 1)
            const newPanY = (centerY - clientY) * (DOUBLE_TAP_ZOOM - 1)
            const clamped = clampPan(newPanX, newPanY, DOUBLE_TAP_ZOOM)
            setScale(DOUBLE_TAP_ZOOM)
            setPanX(clamped.x)
            setPanY(clamped.y)
        }
    }, [])

    // --- タッチイベント ---
    const handleTouchStart = useCallback((e: React.TouchEvent) => {
        const g = gestureRef.current
        const s = stateRef.current

        if (e.touches.length === 2) {
            // ピンチ開始
            g.gestureType = 'pinch'
            g.lastPinchDist = getDistance(e.touches[0], e.touches[1])
            const mid = getMidpoint(e.touches[0], e.touches[1])
            g.pinchMidX = mid.x
            g.pinchMidY = mid.y
            g.startScale = s.scale
            g.startPanX = s.panX
            g.startPanY = s.panY
            setIsPinching(true)
            setIsSwiping(false)
            return
        }

        if (e.touches.length === 1) {
            const touch = e.touches[0]
            g.gestureType = 'none'
            g.startX = touch.clientX
            g.startY = touch.clientY
            g.startPanX = s.panX
            g.startPanY = s.panY
        }
    }, [])

    const handleTouchMove = useCallback((e: React.TouchEvent) => {
        const g = gestureRef.current
        const s = stateRef.current

        if (e.touches.length === 2 && g.gestureType === 'pinch') {
            // ピンチ中
            const newDist = getDistance(e.touches[0], e.touches[1])
            const ratio = newDist / g.lastPinchDist
            const newScale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, g.startScale * ratio))

            // ピンチ中心を基準にパン調整
            const centerX = window.innerWidth / 2
            const centerY = window.innerHeight / 2
            const focalX = g.pinchMidX - centerX
            const focalY = g.pinchMidY - centerY
            const scaleChange = newScale / g.startScale
            const newPanX = g.startPanX - focalX * (scaleChange - 1)
            const newPanY = g.startPanY - focalY * (scaleChange - 1)

            const clamped = clampPan(newPanX, newPanY, newScale)
            setScale(newScale)
            setPanX(clamped.x)
            setPanY(clamped.y)
            return
        }

        if (e.touches.length !== 1) return
        if (g.gestureType === 'pinch') return // ピンチ中に指が1本になった

        const touch = e.touches[0]
        const dx = touch.clientX - g.startX
        const dy = touch.clientY - g.startY

        if (s.scale > 1) {
            // ズーム中 → パン（範囲制限付き）
            g.gestureType = 'pan'
            const clamped = clampPan(g.startPanX + dx, g.startPanY + dy, s.scale)
            setPanX(clamped.x)
            setPanY(clamped.y)
            return
        }

        // 等倍時 → ジェスチャー方向を判定
        if (g.gestureType === 'none') {
            if (Math.abs(dx) > 8 || Math.abs(dy) > 8) {
                g.gestureType = Math.abs(dx) > Math.abs(dy) ? 'swipe-x' : 'swipe-y'
                setIsSwiping(true)
            } else {
                return
            }
        }

        if (g.gestureType === 'swipe-x') {
            // 横スワイプ（画像切り替え）
            let clampedDx = dx
            if ((s.currentIndex === 0 && dx > 0) || (s.currentIndex === s.mediasLength - 1 && dx < 0)) {
                clampedDx = dx * 0.3
            }
            // 画像1枚のみの場合もラバーバンド
            if (s.mediasLength <= 1) {
                clampedDx = dx * 0.3
            }
            setOffsetX(clampedDx)
        } else if (g.gestureType === 'swipe-y') {
            // 縦スワイプ（閉じる）
            setOffsetY(dy)
        }
    }, [])

    const handleTouchEnd = useCallback(
        (e: React.TouchEvent) => {
            const g = gestureRef.current
            const s = stateRef.current

            // ピンチ終了（指が減った場合）
            if (g.gestureType === 'pinch') {
                if (e.touches.length === 0) {
                    g.gestureType = 'none'
                    setIsPinching(false)
                    // ズームが1以下ならリセット
                    if (s.scale <= 1) {
                        setScale(1)
                        setPanX(0)
                        setPanY(0)
                    } else {
                        // ズーム維持の場合もパン範囲を補正
                        const clamped = clampPan(s.panX, s.panY, s.scale)
                        setPanX(clamped.x)
                        setPanY(clamped.y)
                    }
                }
                return
            }

            if (e.touches.length > 0) return

            const now = Date.now()
            const touch = e.changedTouches[0]

            // ジェスチャーが発火してない場合 → タップ判定
            if (g.gestureType === 'none') {
                const timeDiff = now - g.lastTapTime
                const distDiff = Math.hypot(touch.clientX - g.lastTapX, touch.clientY - g.lastTapY)

                if (timeDiff < DOUBLE_TAP_DELAY && distDiff < 30) {
                    // ダブルタップ
                    if (g.tapTimeout) clearTimeout(g.tapTimeout)
                    g.tapTimeout = null
                    g.lastTapTime = 0
                    handleDoubleTap(touch.clientX, touch.clientY)
                } else {
                    g.lastTapTime = now
                    g.lastTapX = touch.clientX
                    g.lastTapY = touch.clientY
                    // シングルタップの遅延処理は不要（特に何もしない）
                }
                return
            }

            if (g.gestureType === 'swipe-x') {
                // 横スワイプ完了
                const ox = s.panX // offsetXはstateなのでstateRefには入ってない、直接参照
                // ここではsetState経由で確認するのが難しいので、DOMから直接は取れない
                // finishSwipe的な処理をインラインで
                setOffsetX((currentOffsetX) => {
                    if (currentOffsetX < -SWIPE_X_THRESHOLD && s.currentIndex < s.mediasLength - 1) {
                        // 次の画像へ（setStateの中からsetStateを呼ぶ代わりにqueueMicrotaskを使う）
                        queueMicrotask(() => {
                            setCurrentIndex(s.currentIndex + 1)
                            setScale(1)
                            setPanX(0)
                            setPanY(0)
                        })
                    } else if (currentOffsetX > SWIPE_X_THRESHOLD && s.currentIndex > 0) {
                        queueMicrotask(() => {
                            setCurrentIndex(s.currentIndex - 1)
                            setScale(1)
                            setPanX(0)
                            setPanY(0)
                        })
                    }
                    return 0
                })
                setIsSwiping(false)
            } else if (g.gestureType === 'swipe-y') {
                // 縦スワイプ完了
                setOffsetY((currentOffsetY) => {
                    if (Math.abs(currentOffsetY) > SWIPE_Y_THRESHOLD) {
                        queueMicrotask(() => {
                            setMedias([])
                            setCurrentIndex(0)
                            setOffsetX(0)
                            setOffsetY(0)
                            setIsSwiping(false)
                            setScale(1)
                            setPanX(0)
                            setPanY(0)
                        })
                    }
                    return 0
                })
                setIsSwiping(false)
            } else if (g.gestureType === 'pan') {
                // パン終了 — 何もしない（位置はそのまま）
            }

            g.gestureType = 'none'
        },
        [handleDoubleTap]
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

    // 画像切り替え時にジェスチャーリセット
    useEffect(() => {
        gestureRef.current.gestureType = 'none'
    }, [currentIndex])

    const currentMedia = medias[currentIndex]

    const value = useMemo(() => ({ open }), [open])

    // 背景の透明度（縦スワイプ時にフェード）
    const dismissProgress = Math.min(Math.abs(offsetY) / (SWIPE_Y_THRESHOLD * 1.5), 1)
    const bgOpacity = 0.9 * (1 - dismissProgress * 0.5)

    // アニメーション制御
    const isAnimating = !isSwiping && !isPinching
    const transitionStyle = isAnimating ? 'transform 0.25s ease-out, opacity 0.25s ease-out' : 'none'

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
                        backgroundColor: `rgba(0, 0, 0, ${bgOpacity})`,
                        zIndex: 9999,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        overflow: 'hidden',
                        touchAction: 'none',
                        transition: isAnimating ? 'background-color 0.25s ease-out' : 'none'
                    }}
                    onClick={(e) => {
                        if (e.target === e.currentTarget) close()
                    }}
                >
                    {/* ジェスチャー領域 */}
                    <div
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            width: '100%',
                            height: '100%',
                            transform: `translateX(${offsetX}px) translateY(${offsetY}px)`,
                            opacity: 1 - dismissProgress * 0.3,
                            transition: transitionStyle,
                            willChange: 'transform, opacity'
                        }}
                        onTouchStart={handleTouchStart}
                        onTouchMove={handleTouchMove}
                        onTouchEnd={handleTouchEnd}
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
                                    pointerEvents: 'auto',
                                    transform: `scale(${scale}) translate(${panX / scale}px, ${panY / scale}px)`,
                                    transition: isPinching ? 'none' : 'transform 0.25s ease-out',
                                    transformOrigin: 'center center',
                                    willChange: 'transform'
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
                </div>
            )}
        </MediaViewerContext.Provider>
    )
}

export const useMediaViewer = (): MediaViewerState => {
    return useContext(MediaViewerContext)
}
