import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { motion, useMotionValue, useTransform } from 'motion/react'
import { animate } from 'motion'
import { useTranslation } from 'react-i18next'

import { MdClose, MdInfoOutline, MdMusicNote, MdPlayCircle, MdStop, MdViewInAr } from 'react-icons/md'
import { CfmActionsProvider, CircularProgress, OverlaySurface, useCfmActions } from '@concrnt/ui'
import styles from './MediaViewer.module.css'
import { ModelViewer } from '../components/ModelViewer'
import { Drawer } from '../ui/Drawer'
import { useAudioPlayer } from './AudioPlayer'
import { useMediaProxy } from './MediaProxy'

export interface MediaItem {
    mediaURL: string
    mediaType: string
    thumbnailURL?: string
    altText?: string
    // メディアを含む投稿のURI。あれば右上のiボタンから投稿ドロワーで投稿単体ビューを出す
    messageURI?: string
}

// 一覧を渡さず、index → メディアの解決をコールバックに委ねるモード。
// 件数が未知なのでページインジケーターは出さず、読み込み済みの末尾で「次へ」が押されたら
// loadMore で追加読み込みをキックし、解決後に自動で次へ進む
export interface MediaSource {
    // index 番目のメディア。範囲外(未読み込み含む)は null
    getMedia: (index: number) => MediaItem | null
    // 追加読み込み。まだ続きがあり得るなら true、読み切ったら false を返す
    loadMore?: () => Promise<boolean>
}

interface MediaViewerState {
    open: (medias: MediaItem[], startIndex?: number) => void
    openSource: (source: MediaSource, startIndex?: number) => void
}

const MediaViewerContext = createContext<MediaViewerState>({
    open: () => {},
    openSource: () => {}
})

// ビューア内部の表現。配列モードは length 付き(インジケーター表示用)、コールバックモードは length なし
interface ViewerSource extends MediaSource {
    length?: number
}

interface Props {
    children: ReactNode
    // 投稿ドロワーの中身。ビューアは views/Post を直接importしない(循環import回避のためマウント側で注入する)
    renderPost?: (uri: string) => ReactNode
}

const SWIPE_X_THRESHOLD = 50
const SWIPE_Y_THRESHOLD = 120
const DOUBLE_TAP_DELAY = 300
const DOUBLE_TAP_ZOOM = 2.5
const MIN_SCALE = 1
const MAX_SCALE = 5
const IMAGE_GAP = 5
const ANIM_CONFIG = { type: 'tween' as const, ease: 'easeOut' as const, duration: 0.25 }
const INERTIA_MULTIPLIER = 0.3
const INERTIA_DURATION = 1
const INERTIA_EASE: [number, number, number, number] = [0.25, 1, 0.5, 1]

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
    // 慣性用: 速度追跡
    prevMoveX: number
    prevMoveY: number
    prevMoveTime: number
    velocityX: number
    velocityY: number
}

const getDistance = (t1: React.Touch, t2: React.Touch) => Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY)

const getMidpoint = (t1: React.Touch, t2: React.Touch) => ({
    x: (t1.clientX + t2.clientX) / 2,
    y: (t1.clientY + t2.clientY) / 2
})

export const MediaViewerProvider = (props: Props) => {
    const [source, setSource] = useState<ViewerSource | null>(null)
    const [currentIndex, setCurrentIndex] = useState(0)
    // loadMore が false を返したら以後は呼ばない
    const [exhausted, setExhausted] = useState(false)
    const [loadingMore, setLoadingMore] = useState(false)
    const loadingMoreRef = useRef(false)
    const isOpen = source !== null

    // 最後に読み込みが完了(または失敗)した画像のsrc。現在のsrcと違う間は読み込み中とみなし、
    // 前の画像の上にスピナーを重ねて「次へ」への反応を即座に返す
    const [loadedSrc, setLoadedSrc] = useState<string | null>(null)

    const currentMedia = source?.getMedia(currentIndex) ?? null
    const prevMedia = currentIndex > 0 ? (source?.getMedia(currentIndex - 1) ?? null) : null
    const nextMedia = source?.getMedia(currentIndex + 1) ?? null
    const canLoadMore = !!source?.loadMore && !exhausted
    const { t } = useTranslation('', { keyPrefix: 'components.mediaViewer' })

    // 投稿ドロワー: 開くたびに閉じた状態から
    const [drawerOpen, setDrawerOpen] = useState(false)
    // 画像領域。スワイプ幅・パンの上限・ズーム焦点はビューポートではなくここを基準にする(web版と同型)
    const stageRef = useRef<HTMLDivElement>(null)
    const hasPost = currentMedia?.messageURI !== undefined

    // --- motion values ---
    const mvOffsetX = useMotionValue(0)
    const mvOffsetY = useMotionValue(0)

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
        const stage = stageRef.current
        const vpW = stage?.clientWidth ?? window.innerWidth
        const vpH = stage?.clientHeight ?? window.innerHeight

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
        prevMoveX: 0,
        prevMoveY: 0,
        prevMoveTime: 0,
        velocityX: 0,
        velocityY: 0
    })

    const stateRef = useRef({ currentIndex: 0, hasPrev: false, hasNext: false, canLoadMore: false, isImage: false })
    stateRef.current = {
        currentIndex,
        hasPrev: prevMedia !== null,
        hasNext: nextMedia !== null,
        canLoadMore,
        isImage: currentMedia?.mediaType.startsWith('image/') ?? false
    }

    const getPageWidth = useCallback(() => (stageRef.current?.clientWidth ?? window.innerWidth) + IMAGE_GAP, [])

    // ステージ中央のビューポート座標(ズーム焦点の基準)
    const getStageCenter = useCallback(() => {
        const rect = stageRef.current?.getBoundingClientRect()
        if (!rect) return { x: window.innerWidth / 2, y: window.innerHeight / 2 }
        return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }
    }, [])

    const resetMotion = useCallback(() => {
        mvOffsetX.set(0)
        mvOffsetY.set(0)
        mvScale.set(1)
        mvPanX.set(0)
        mvPanY.set(0)
    }, [mvOffsetX, mvOffsetY, mvScale, mvPanX, mvPanY])

    const openSource = useCallback(
        (source: ViewerSource, startIndex?: number) => {
            resetMotion()
            loadingMoreRef.current = false
            setLoadingMore(false)
            setExhausted(false)
            setDrawerOpen(false)
            setSource(source)
            setCurrentIndex(startIndex ?? 0)
        },
        [resetMotion]
    )

    const open = useCallback(
        (medias: MediaItem[], startIndex?: number) => {
            openSource({ getMedia: (index) => medias[index] ?? null, length: medias.length }, startIndex)
        },
        [openSource]
    )

    const close = useCallback(() => {
        setSource(null)
        setCurrentIndex(0)
        setDrawerOpen(false)
        resetMotion()
    }, [resetMotion])

    // Androidバックボタン: ビューアはOverlaySurfaceなのでOverlayStackBackBridge経由で閉じる
    // (投稿ドロワーが開いていればそちらが先に閉じる)

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

    // 次へ: 読み込み済みならそのまま進み、末尾なら loadMore をキックして解決後に進む。
    // 追加分にメディアが無ければ(読み切るまで)続けて読む
    const goNext = useCallback(() => {
        const s = stateRef.current
        if (s.hasNext) {
            changeImage(s.currentIndex + 1)
            return
        }
        if (!source?.loadMore || !s.canLoadMore || loadingMoreRef.current) return
        const target = s.currentIndex + 1
        const loadMore = source.loadMore
        loadingMoreRef.current = true
        setLoadingMore(true)
        const run = (): Promise<void> =>
            loadMore().then((more) => {
                if (source.getMedia(target)) {
                    changeImage(target)
                    return
                }
                if (more) return run()
                setExhausted(true)
            })
        run()
            .catch((e) => {
                console.error('Failed to load more medias', e)
            })
            .finally(() => {
                loadingMoreRef.current = false
                setLoadingMore(false)
            })
    }, [source, changeImage])

    // --- ダブルタップ処理（ズームは画像のみ） ---
    const handleDoubleTap = useCallback(
        (clientX: number, clientY: number) => {
            if (!stateRef.current.isImage) return
            const currentScale = mvScale.get()
            if (currentScale > 1) {
                animate(mvScale, 1, ANIM_CONFIG)
                animate(mvPanX, 0, ANIM_CONFIG)
                animate(mvPanY, 0, ANIM_CONFIG)
            } else {
                const center = getStageCenter()
                const newPanX = (center.x - clientX) * (DOUBLE_TAP_ZOOM - 1)
                const newPanY = (center.y - clientY) * (DOUBLE_TAP_ZOOM - 1)
                const clamped = clampPan(newPanX, newPanY, DOUBLE_TAP_ZOOM)
                animate(mvScale, DOUBLE_TAP_ZOOM, ANIM_CONFIG)
                animate(mvPanX, clamped.x, ANIM_CONFIG)
                animate(mvPanY, clamped.y, ANIM_CONFIG)
            }
        },
        [mvScale, mvPanX, mvPanY, clampPan, getStageCenter]
    )

    // --- タッチイベント ---
    const handleTouchStart = useCallback(
        (e: React.TouchEvent) => {
            const g = gestureRef.current

            if (e.touches.length === 2) {
                // ピンチズームは画像のみ
                if (!stateRef.current.isImage) return
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
                // 慣性用の速度リセット
                g.prevMoveX = touch.clientX
                g.prevMoveY = touch.clientY
                g.prevMoveTime = performance.now()
                g.velocityX = 0
                g.velocityY = 0
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

                const center = getStageCenter()
                const focalX = g.pinchMidX - center.x
                const focalY = g.pinchMidY - center.y
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

                // 慣性用の速度計算
                const now = performance.now()
                const dt = now - g.prevMoveTime
                if (dt > 0) {
                    g.velocityX = (touch.clientX - g.prevMoveX) / dt
                    g.velocityY = (touch.clientY - g.prevMoveY) / dt
                }
                g.prevMoveX = touch.clientX
                g.prevMoveY = touch.clientY
                g.prevMoveTime = now
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
                // 端(未読み込みの先も含む)は引っ張り抵抗をつける
                if ((!s.hasPrev && dx > 0) || (!s.hasNext && dx < 0)) {
                    clampedDx = dx * 0.3
                }
                mvOffsetX.set(clampedDx)
            } else if (g.gestureType === 'swipe-y') {
                mvOffsetY.set(dy)
            }
        },
        [mvScale, mvPanX, mvPanY, mvOffsetX, mvOffsetY, clampPan, getStageCenter]
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
                // 横スワイプ完了
                const currentOX = mvOffsetX.get()
                const pw = getPageWidth()

                if (currentOX < -SWIPE_X_THRESHOLD && s.hasNext) {
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
                } else if (currentOX > SWIPE_X_THRESHOLD && s.hasPrev) {
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
                    // 読み込み済みの末尾で次へスワイプ → 追加読み込みをキック(解決後に自動で進む)
                    if (currentOX < -SWIPE_X_THRESHOLD && s.canLoadMore) goNext()
                }
            } else if (g.gestureType === 'swipe-y') {
                const currentOY = mvOffsetY.get()
                if (Math.abs(currentOY) > SWIPE_Y_THRESHOLD) {
                    close()
                } else {
                    animate(mvOffsetY, 0, ANIM_CONFIG)
                }
            } else if (g.gestureType === 'pan') {
                // パン終了 — 慣性アニメーション
                const currentScale = mvScale.get()
                const vx = g.velocityX * 1000 // px/ms → px/s
                const vy = g.velocityY * 1000

                const targetX = mvPanX.get() + vx * INERTIA_MULTIPLIER
                const targetY = mvPanY.get() + vy * INERTIA_MULTIPLIER
                const clamped = clampPan(targetX, targetY, currentScale)

                animate(mvPanX, clamped.x, {
                    type: 'tween',
                    ease: INERTIA_EASE,
                    duration: INERTIA_DURATION
                })
                animate(mvPanY, clamped.y, {
                    type: 'tween',
                    ease: INERTIA_EASE,
                    duration: INERTIA_DURATION
                })
            }

            g.gestureType = 'none'
        },
        [mvOffsetX, mvOffsetY, mvScale, mvPanX, mvPanY, clampPan, handleDoubleTap, close, getPageWidth, goNext]
    )

    // bodyのスクロール抑制はOverlaySurface(OverlayStackProvider)が行う

    useEffect(() => {
        gestureRef.current.gestureType = 'none'
    }, [currentIndex])

    const value = useMemo(() => ({ open, openSource }), [open, openSource])

    const parentCfmActions = useCfmActions()
    const { getImageURL } = useMediaProxy()

    const isImage = currentMedia?.mediaType.startsWith('image/') ?? false
    const currentSrc = isImage && currentMedia ? getImageURL(currentMedia.mediaURL) : null
    const imageLoading = currentSrc !== null && currentSrc !== loadedSrc
    // 画像の取得待ち、または末尾での追加読み込み待ち
    const showSpinner = imageLoading || loadingMore

    return (
        <MediaViewerContext.Provider value={value}>
            <CfmActionsProvider
                value={{
                    ...parentCfmActions,
                    openMedias: open
                }}
            >
                {props.children}
            </CfmActionsProvider>

            {/* OverlaySurfaceに載せる: 内側から開くDrawer(同じくOverlaySurface)がDOM順で上に積まれるようにする。
                openはcurrentMediaの有無まで含める(nullの瞬間にfalseが渡るとhostが破棄されて再表示されない) */}
            <OverlaySurface open={isOpen && currentMedia !== null} onClose={close}>
                {source && currentMedia && (
                    <motion.div
                        data-testid="media-viewer"
                        style={{
                            position: 'absolute',
                            inset: 0,
                            backgroundColor: bgColor,
                            display: 'flex',
                            flexDirection: 'row',
                            overflow: 'hidden'
                        }}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.15 }}
                    >
                        {/* ステージ: 画像領域 */}
                        <div
                            ref={stageRef}
                            data-testid="media-viewer-stage"
                            style={{
                                flex: 1,
                                minWidth: 0,
                                height: '100%',
                                position: 'relative',
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
                            {/* カルーセル: 前・現在・次 のメディアを横並び */}
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
                                {/* 前のメディア */}
                                <div
                                    style={{
                                        flexShrink: 0,
                                        width: '100%',
                                        height: '100%',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        marginLeft: `calc(-100% - ${IMAGE_GAP}px)`
                                    }}
                                >
                                    {prevMedia && <SlidePreview media={prevMedia} />}
                                </div>

                                {/* 現在のメディア（画像はズーム・パン対応） */}
                                <div
                                    style={{
                                        position: 'relative',
                                        flexShrink: 0,
                                        width: '100%',
                                        height: '100%',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center'
                                    }}
                                >
                                    {currentSrc !== null ? (
                                        <motion.img
                                            src={currentSrc}
                                            alt={currentMedia.altText ?? ''}
                                            onLoad={(e) => setLoadedSrc(e.currentTarget.getAttribute('src'))}
                                            onError={(e) => setLoadedSrc(e.currentTarget.getAttribute('src'))}
                                            style={{
                                                maxWidth: '90%',
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
                                            playsInline
                                            style={{
                                                maxWidth: '90%',
                                                maxHeight: '85dvh'
                                            }}
                                            onClick={(e) => e.stopPropagation()}
                                        />
                                    ) : currentMedia.mediaType.startsWith('audio/') ? (
                                        <AudioSlide media={currentMedia} />
                                    ) : currentMedia.mediaType.startsWith('model/') ? (
                                        <div
                                            // model-viewerのカメラ操作とスワイプが競合しないよう、タッチをここで止める
                                            onClick={(e) => e.stopPropagation()}
                                            onTouchStart={(e) => e.stopPropagation()}
                                            onTouchMove={(e) => e.stopPropagation()}
                                            onTouchEnd={(e) => e.stopPropagation()}
                                        >
                                            <ModelViewer
                                                src={currentMedia.mediaURL}
                                                style={{
                                                    backgroundColor: '#3f3f3f',
                                                    width: '90%',
                                                    height: '70dvh',
                                                    borderRadius: '8px'
                                                }}
                                            />
                                        </div>
                                    ) : (
                                        <span style={{ color: 'rgba(255, 255, 255, 0.8)' }}>
                                            Unsupported media type: {currentMedia.mediaType}
                                        </span>
                                    )}
                                    {/* 読み込み中は前の画像(src差し替え前の表示)の上にスピナーを重ねる */}
                                    {showSpinner && (
                                        <div
                                            style={{
                                                position: 'absolute',
                                                top: '50%',
                                                left: '50%',
                                                transform: 'translate(-50%, -50%)',
                                                // svgをインラインのまま置くと行送り分だけ縦に伸びて楕円になるのでflexで揃える
                                                display: 'flex',
                                                padding: '12px',
                                                borderRadius: '50%',
                                                background: 'rgba(0, 0, 0, 0.45)',
                                                color: 'white',
                                                pointerEvents: 'none',
                                                animation: `${styles.spinnerFadeIn} 0.2s ease-out 150ms both`
                                            }}
                                        >
                                            <CircularProgress size={40} />
                                        </div>
                                    )}
                                </div>

                                {/* 次のメディア */}
                                <div
                                    style={{
                                        flexShrink: 0,
                                        width: '100%',
                                        height: '100%',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center'
                                    }}
                                >
                                    {nextMedia && <SlidePreview media={nextMedia} />}
                                </div>
                            </motion.div>

                            {/* 閉じるボタン(左上) */}
                            <button
                                data-testid="media-viewer-close"
                                title={t('close')}
                                aria-label={t('close')}
                                onClick={(e) => {
                                    e.stopPropagation()
                                    close()
                                }}
                                style={{
                                    position: 'absolute',
                                    top: 'max(12px, env(safe-area-inset-top))',
                                    left: '12px',
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

                            {/* 右上: 投稿ドロワーを開く。投稿URIがあるときのみ */}
                            {hasPost && (
                                <button
                                    data-testid="media-viewer-info"
                                    title={t('showPost')}
                                    aria-label={t('showPost')}
                                    onClick={(e) => {
                                        e.stopPropagation()
                                        setDrawerOpen(true)
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
                                    <MdInfoOutline size={24} />
                                </button>
                            )}

                            {/* ページインジケーター(件数が分かる配列モードのみ) */}
                            {source.length !== undefined && source.length > 1 && (
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
                                    {Array.from({ length: source.length }, (_, index) => (
                                        <div
                                            key={index}
                                            style={{
                                                width: index === currentIndex ? '10px' : '7px',
                                                height: index === currentIndex ? '10px' : '7px',
                                                borderRadius: '50%',
                                                backgroundColor:
                                                    index === currentIndex ? 'white' : 'rgba(255, 255, 255, 0.4)',
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

                        {/* 投稿ドロワー: 従来のDrawer(BottomSheet)でオーバーレイ表示。
                        カルーセルの子にするとドロワー内のtouchmoveがスワイプ処理に流れるので、ステージの兄弟に置く。
                        注意: ここはStackLayoutの外なのでドロワー内のuseStack().pushは既定のno-op
                        (作者/リプライのタップ遷移は効かない)。返信・リアクションはProviderが上にあるので動く */}
                        <Drawer open={drawerOpen && hasPost} onClose={() => setDrawerOpen(false)}>
                            {currentMedia.messageURI !== undefined && (
                                <div key={currentMedia.messageURI}>{props.renderPost?.(currentMedia.messageURI)}</div>
                            )}
                        </Drawer>
                    </motion.div>
                )}
            </OverlaySurface>
        </MediaViewerContext.Provider>
    )
}

// 前後スライド用の軽量プレビュー（modelやaudioは実体をロードしない）
const SlidePreview = ({ media }: { media: MediaItem }) => {
    const { getImageURL } = useMediaProxy()
    const kind = media.mediaType.split('/')[0]
    switch (kind) {
        case 'image':
            return (
                <img
                    src={getImageURL(media.mediaURL)}
                    alt={media.altText ?? ''}
                    style={{
                        maxWidth: '90%',
                        maxHeight: '85dvh',
                        objectFit: 'contain',
                        userSelect: 'none',
                        pointerEvents: 'none'
                    }}
                    draggable={false}
                />
            )
        case 'video':
            return (
                <video
                    src={media.mediaURL}
                    muted
                    playsInline
                    preload="metadata"
                    style={{
                        maxWidth: '90%',
                        maxHeight: '85dvh',
                        pointerEvents: 'none'
                    }}
                />
            )
        case 'audio':
            return <MdMusicNote size={96} style={{ color: 'rgba(255, 255, 255, 0.8)' }} />
        case 'model':
            return <MdViewInAr size={96} style={{ color: 'rgba(255, 255, 255, 0.8)' }} />
        default:
            return null
    }
}

const AudioSlide = ({ media }: { media: MediaItem }) => {
    const audioPlayer = useAudioPlayer()
    const isPlaying = audioPlayer.nowPlaying === media.mediaURL

    return (
        <div
            style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '12px',
                cursor: 'pointer'
            }}
            onClick={(e) => {
                e.stopPropagation()
                if (isPlaying) {
                    audioPlayer.stop()
                } else {
                    audioPlayer.play(media.mediaURL)
                }
            }}
        >
            {isPlaying ? (
                <MdStop size={96} style={{ color: 'rgba(255, 255, 255, 0.8)' }} />
            ) : (
                <MdPlayCircle size={96} style={{ color: 'rgba(255, 255, 255, 0.8)' }} />
            )}
            {media.altText && <span style={{ color: 'rgba(255, 255, 255, 0.6)' }}>{media.altText}</span>}
        </div>
    )
}

export const useMediaViewer = (): MediaViewerState => {
    return useContext(MediaViewerContext)
}
