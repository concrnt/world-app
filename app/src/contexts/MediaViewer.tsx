import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import {
    animate,
    cancelFrame,
    frame,
    LazyMotion,
    motion,
    pinchFeatures,
    useDragControls,
    useMotionValue,
    useTransform
} from 'motion/react'
import type { PanInfo, TapInfo } from 'motion/react'
import { useTranslation } from 'react-i18next'

import { MdClose, MdInfoOutline, MdMusicNote, MdPlayCircle, MdStop, MdViewInAr } from 'react-icons/md'
import { CircularProgress, OverlaySurface } from '@concrnt/ui'
import styles from './MediaViewer.module.css'
import { ModelViewer } from '../components/ModelViewer'
import { HlsVideo } from '../components/HlsVideo'
import { Drawer } from '../ui/Drawer'
import { useAudioPlayer } from './AudioPlayer'
import { useMediaProxy } from './MediaProxy'

export interface MediaItem {
    mediaURL: string
    mediaType: string
    thumbnailURL?: string
    altText?: string
    // HLS 動画は ABR の variant 切替で固有サイズが変わるので、要素の寸法はこの比率だけで決める
    aspectRatio?: { width: number; height: number }
    // メディアを含む投稿のURI。あれば右上のiボタンから投稿ドロワーで投稿単体ビューを出す
    messageURI?: string
    // 元投稿の medias 内での位置と件数。コールバックモードでも投稿内のページインジケーターを出すために使う
    postMediaIndex?: number
    postMediaCount?: number
}

// 一覧を渡さず、index → メディアの解決をコールバックに委ねるモード。
// 全体の件数は未知なのでページインジケーターは投稿内の位置(postMediaIndex/postMediaCount)がある場合のみ
// その範囲で出す。読み込み済みの末尾で「次へ」が押されたら loadMore で追加読み込みをキックし、解決後に自動で次へ進む
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
const DOUBLE_TAP_ZOOM = 2.5
const MIN_SCALE = 1
const MAX_SCALE = 5
const IMAGE_GAP = 5
// カルーセルの移動(ページ送り・閉じるスワイプの取り消し)
const ANIM_CONFIG = { type: 'tween' as const, ease: 'easeOut' as const, duration: 0.25 }
// ズーム・パンの補正(motion公式のpinchサンプルと同じばね)
const ZOOM_SPRING = { type: 'spring' as const, stiffness: 305, damping: 33 }
// パンを離したとき、速度×この秒数ぶん流れてから端に収まる
const PAN_MOMENTUM = 0.2
// 端(未読み込みの先も含む)を引っ張ったときの抵抗
const EDGE_ELASTIC = 0.3
const DOUBLE_TAP = { count: 2 }

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
    // embed に aspectRatio が無い HLS 動画は loadedmetadata の最初の variant で比率を確定して以後固定する
    const [metadataRatio, setMetadataRatio] = useState<{ src: string; ratio: number } | null>(null)

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
    // カルーセル(前・現在・次)の位置。横はページ送り、縦は閉じるスワイプ
    const mvOffsetX = useMotionValue(0)
    const mvOffsetY = useMotionValue(0)

    // 現在のメディアのズームレイヤー。pinch・drag・animate() が同じ値を読み書きする
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

    // 拡大率 s のとき、画像の端がステージの内側に入らずに動かせる範囲へ収める
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

    // カルーセル(スワイプ)とズームレイヤー(パン)のdragは、どちらもpointerdownから手動で開始する
    const carouselDrag = useDragControls()
    const zoomDrag = useDragControls()
    // 進行中のポインター操作をどちらのdragが担当しているか。
    // 1本目の指で始まったスワイプが2本目でピンチになったら、同じ指をズーム側のdragに引き継ぐ
    const pointerGestureRef = useRef<{ kind: 'carousel' | 'zoom'; downEvent: PointerEvent } | null>(null)
    const zoomDraggingRef = useRef(false)
    // ページ送りのアニメーション中。ここで掴むとアニメーションが止まって中途半端な位置に残るので受け付けない
    const pagingRef = useRef(false)
    // ピンチ自身の戻りアニメーションが終わるのを待ってから端を補正する、その待機
    const settlingRef = useRef<VoidFunction>(() => {})

    const stateRef = useRef({ currentIndex: 0, hasPrev: false, hasNext: false, canLoadMore: false, isImage: false })
    stateRef.current = {
        currentIndex,
        hasPrev: prevMedia !== null,
        hasNext: nextMedia !== null,
        canLoadMore,
        isImage: currentMedia?.mediaType.startsWith('image/') ?? false
    }

    const getPageWidth = useCallback(() => (stageRef.current?.clientWidth ?? window.innerWidth) + IMAGE_GAP, [])

    // ズームが落ち着いたら、画像の端が見えないよう収まる位置へ戻す。フリックは少し流れてから止まる
    const settleEdges = useCallback(
        (velocity = { x: 0, y: 0 }) => {
            const target = clampPan(
                mvPanX.get() + velocity.x * PAN_MOMENTUM,
                mvPanY.get() + velocity.y * PAN_MOMENTUM,
                mvScale.get()
            )
            animate(mvPanX, target.x, { ...ZOOM_SPRING, velocity: velocity.x })
            animate(mvPanY, target.y, { ...ZOOM_SPRING, velocity: velocity.y })
        },
        [mvScale, mvPanX, mvPanY, clampPan]
    )

    // ピンチを離すと拡大率は上下限の内側へばねで戻るので、それが止まってから callback を呼ぶ
    const afterZoomSettles = useCallback(
        (callback: VoidFunction) => {
            cancelFrame(settlingRef.current)
            let last: number | undefined
            const check = (settlingRef.current = () => {
                const latest = mvScale.get()
                if (latest === last) {
                    cancelFrame(check)
                    callback()
                }
                last = latest
            })
            frame.postRender(check, true)
        },
        [mvScale]
    )

    const resetZoom = useCallback(() => {
        cancelFrame(settlingRef.current)
        // jump: 走っているアニメーションも止める
        mvScale.jump(1)
        mvPanX.jump(0)
        mvPanY.jump(0)
    }, [mvScale, mvPanX, mvPanY])

    const resetMotion = useCallback(() => {
        resetZoom()
        pagingRef.current = false
        mvOffsetX.jump(0)
        mvOffsetY.jump(0)
    }, [resetZoom, mvOffsetX, mvOffsetY])

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
            resetZoom()
            pagingRef.current = false
            mvOffsetX.jump(0)
        },
        [resetZoom, mvOffsetX]
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

    // --- ポインター操作の振り分け ---
    // 拡大中の画像はズームレイヤーのdrag(パン)、それ以外はカルーセルのdrag(スワイプ)。
    // 2本目以降の指はズームレイヤーのpinchが拾う
    const handlePointerDown = useCallback(
        (e: React.PointerEvent) => {
            if (!e.isPrimary) return
            if (e.pointerType === 'mouse' && e.button !== 0) return
            if (stateRef.current.isImage && mvScale.get() > 1) {
                pointerGestureRef.current = { kind: 'zoom', downEvent: e.nativeEvent }
                zoomDrag.start(e)
                return
            }
            // マウスは拡大中のパンのみ(等倍でのスワイプはタッチ/ペン)
            if (e.pointerType === 'mouse') return
            if (pagingRef.current) return
            pointerGestureRef.current = { kind: 'carousel', downEvent: e.nativeEvent }
            carouselDrag.start(e)
        },
        [mvScale, zoomDrag, carouselDrag]
    )

    const handlePointerEnd = useCallback((e: React.PointerEvent) => {
        if (e.isPrimary) pointerGestureRef.current = null
    }, [])

    // --- カルーセル: 横スワイプでページ送り、縦スワイプで閉じる ---
    const handleCarouselDragEnd = useCallback(() => {
        const s = stateRef.current
        const ox = mvOffsetX.get()
        const oy = mvOffsetY.get()

        // dragDirectionLock で片方の軸しか動かない
        if (Math.abs(oy) > Math.abs(ox)) {
            if (Math.abs(oy) > SWIPE_Y_THRESHOLD) {
                close()
            } else {
                animate(mvOffsetY, 0, ANIM_CONFIG)
            }
            return
        }

        const pw = getPageWidth()
        if (ox < -SWIPE_X_THRESHOLD && s.hasNext) {
            pagingRef.current = true
            animate(mvOffsetX, -pw, { ...ANIM_CONFIG, onComplete: () => changeImage(s.currentIndex + 1) })
        } else if (ox > SWIPE_X_THRESHOLD && s.hasPrev) {
            pagingRef.current = true
            animate(mvOffsetX, pw, { ...ANIM_CONFIG, onComplete: () => changeImage(s.currentIndex - 1) })
        } else {
            animate(mvOffsetX, 0, ANIM_CONFIG)
            // 読み込み済みの末尾で次へスワイプ → 追加読み込みをキック(解決後に自動で進む)
            if (ox < -SWIPE_X_THRESHOLD && s.canLoadMore) goNext()
        }
    }, [mvOffsetX, mvOffsetY, close, getPageWidth, changeImage, goNext])

    // --- ズームレイヤー: ピンチ・パン・ダブルタップ(画像のみ) ---
    const handlePinchStart = useCallback(
        (event: Event) => {
            // 新しいピンチは、待機中の端の補正より優先する
            cancelFrame(settlingRef.current)
            const g = pointerGestureRef.current
            if (g?.kind !== 'carousel' || event.type !== 'pointerdown') return
            // 1本目の指で始まったスワイプは取り消し、その指をズームレイヤーのdragに引き継ぐ。
            // ピンチ中のdragの扱いはpinchが面倒を見るので、指が1本残ればそのままパンが続く
            carouselDrag.cancel()
            animate(mvOffsetX, 0, ANIM_CONFIG)
            animate(mvOffsetY, 0, ANIM_CONFIG)
            pointerGestureRef.current = { kind: 'zoom', downEvent: g.downEvent }
            zoomDrag.start(g.downEvent)
        },
        [carouselDrag, zoomDrag, mvOffsetX, mvOffsetY]
    )

    const handlePinchEnd = useCallback(() => {
        // 指が残ってdragが続くなら、補正はdragを離したときに行う
        if (!zoomDraggingRef.current) afterZoomSettles(() => settleEdges())
    }, [afterZoomSettles, settleEdges])

    const handleZoomDragStart = useCallback(() => {
        zoomDraggingRef.current = true
        cancelFrame(settlingRef.current)
    }, [])

    const handleZoomDragEnd = useCallback(
        (_event: PointerEvent, info: PanInfo) => {
            zoomDraggingRef.current = false
            afterZoomSettles(() => settleEdges(info.velocity))
        },
        [afterZoomSettles, settleEdges]
    )

    // tap={{ count: 2 }} なので2回目の素早いタップでだけ呼ばれる。タップした点を中心に拡大、拡大中なら等倍へ
    const handleDoubleTap = useCallback(
        (_event: MouseEvent | TouchEvent | PointerEvent, info: TapInfo) => {
            const rect = stageRef.current?.getBoundingClientRect()
            if (!rect) return
            cancelFrame(settlingRef.current)
            const current = mvScale.get()
            const target = current > 1.05 ? 1 : DOUBLE_TAP_ZOOM

            // ステージ中央からのタップ位置(info.point はページ座標)
            let px = info.point.x - window.scrollX - rect.left - rect.width / 2
            let py = info.point.y - window.scrollY - rect.top - rect.height / 2
            // キーボード操作にはポインター位置が無いので中央で拡大する
            if (Math.abs(px) > rect.width / 2 || Math.abs(py) > rect.height / 2) {
                px = 0
                py = 0
            }

            // 倍率が変わってもタップした点が指の下に留まるようにする
            const ratio = target / current
            const pan = clampPan(px - (px - mvPanX.get()) * ratio, py - (py - mvPanY.get()) * ratio, target)
            animate(mvScale, target, ZOOM_SPRING)
            animate(mvPanX, pan.x, ZOOM_SPRING)
            animate(mvPanY, pan.y, ZOOM_SPRING)
        },
        [mvScale, mvPanX, mvPanY, clampPan]
    )

    const pinchOptions = useMemo(
        () => ({
            // 1倍未満・上限超えは抵抗がつき、離すと指の間を中心に範囲内へ戻る
            scale: { min: MIN_SCALE, max: MAX_SCALE },
            rotate: false,
            transition: ZOOM_SPRING,
            onStart: handlePinchStart,
            onEnd: handlePinchEnd
        }),
        [handlePinchStart, handlePinchEnd]
    )

    // bodyのスクロール抑制はOverlaySurface(OverlayStackProvider)が行う

    const value = useMemo(() => ({ open, openSource }), [open, openSource])

    const { getImageURL } = useMediaProxy()

    const isImage = currentMedia?.mediaType.startsWith('image/') ?? false
    const currentSrc = isImage && currentMedia ? getImageURL(currentMedia.mediaURL) : null
    const isHls = currentMedia?.mediaType === 'application/vnd.apple.mpegurl'
    // HLS は固有サイズ(variant の解像度)に依らず比率×表示枠で寸法を決める。mp4 は従来どおり固有サイズ
    const videoRatio = !isHls
        ? undefined
        : currentMedia.aspectRatio
          ? currentMedia.aspectRatio.width / currentMedia.aspectRatio.height
          : metadataRatio?.src === currentMedia.mediaURL
            ? metadataRatio.ratio
            : undefined
    const imageLoading = currentSrc !== null && currentSrc !== loadedSrc
    // 画像の取得待ち、または末尾での追加読み込み待ち
    const showSpinner = imageLoading || loadingMore

    // ページインジケーター: 配列モードは全体、コールバックモードは元投稿内(複数メディアのときのみ)。
    // 同じ投稿のメディアはグリッド上で連続して並ぶので、ドットの飛び先は現在indexからの相対で求まる
    const postMediaIndex = currentMedia?.postMediaIndex
    const postMediaCount = currentMedia?.postMediaCount
    const dots =
        source && source.length !== undefined
            ? source.length > 1
                ? { length: source.length, active: currentIndex, jump: changeImage }
                : null
            : postMediaCount !== undefined && postMediaCount > 1 && postMediaIndex !== undefined
              ? {
                    length: postMediaCount,
                    active: postMediaIndex,
                    jump: (i: number) => changeImage(currentIndex - postMediaIndex + i)
                }
              : null

    return (
        <MediaViewerContext.Provider value={value}>
            {props.children}

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
                            {/* pinch は motion の既定バンドルに含まれないので LazyMotion で読み込む */}
                            <LazyMotion features={pinchFeatures}>
                                {/* カルーセル: 前・現在・次 のメディアを横並び。
                                dragは handlePointerDown から手動で開始する(拡大中はズームレイヤー側のdragになる) */}
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
                                    drag
                                    dragControls={carouselDrag}
                                    dragListener={false}
                                    dragDirectionLock
                                    dragMomentum={false}
                                    // 前後が無い(未読み込みの先も含む)側は引っ張り抵抗をつける
                                    dragConstraints={{
                                        left: nextMedia ? undefined : 0,
                                        right: prevMedia ? undefined : 0
                                    }}
                                    dragElastic={EDGE_ELASTIC}
                                    onDragEnd={handleCarouselDragEnd}
                                    onPointerDown={handlePointerDown}
                                    onPointerUp={handlePointerEnd}
                                    onPointerCancel={handlePointerEnd}
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

                                    {/* 現在のメディア */}
                                    <div
                                        style={{
                                            position: 'relative',
                                            flexShrink: 0,
                                            width: '100%',
                                            height: '100%'
                                        }}
                                    >
                                        {/* ズームレイヤー(画像のみ有効)。ステージ全面を覆うので、画像の外に置いた指からでもピンチできる。
                                        拡大・パンは画像ではなくこのレイヤーの scale/x/y で行う */}
                                        <motion.div
                                            style={{
                                                position: 'absolute',
                                                inset: 0,
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                scale: mvScale,
                                                x: mvPanX,
                                                y: mvPanY
                                            }}
                                            pinch={isImage ? pinchOptions : false}
                                            drag={isImage}
                                            dragControls={zoomDrag}
                                            dragListener={false}
                                            dragMomentum={false}
                                            onDragStart={handleZoomDragStart}
                                            onDragEnd={handleZoomDragEnd}
                                            tap={isImage ? DOUBLE_TAP : undefined}
                                            onTap={isImage ? handleDoubleTap : undefined}
                                        >
                                            {currentSrc !== null ? (
                                                <img
                                                    src={currentSrc}
                                                    alt={currentMedia.altText ?? ''}
                                                    onLoad={(e) => setLoadedSrc(e.currentTarget.getAttribute('src'))}
                                                    onError={(e) => setLoadedSrc(e.currentTarget.getAttribute('src'))}
                                                    style={{
                                                        maxWidth: '90%',
                                                        maxHeight: '85dvh',
                                                        objectFit: 'contain',
                                                        userSelect: 'none'
                                                    }}
                                                    draggable={false}
                                                    ref={imgRef}
                                                />
                                            ) : currentMedia.mediaType.startsWith('video/') ||
                                              currentMedia.mediaType === 'application/vnd.apple.mpegurl' ? (
                                                <HlsVideo
                                                    src={currentMedia.mediaURL}
                                                    poster={currentMedia.thumbnailURL}
                                                    controls
                                                    autoPlay
                                                    playsInline
                                                    style={
                                                        videoRatio !== undefined
                                                            ? {
                                                                  width: `min(90%, calc(85dvh * ${videoRatio}))`,
                                                                  aspectRatio: String(videoRatio)
                                                              }
                                                            : {
                                                                  maxWidth: '90%',
                                                                  maxHeight: '85dvh'
                                                              }
                                                    }
                                                    onLoadedMetadata={(e) => {
                                                        if (!isHls || currentMedia.aspectRatio) return
                                                        if (metadataRatio?.src === currentMedia.mediaURL) return
                                                        const v = e.currentTarget
                                                        if (!v.videoWidth || !v.videoHeight) return
                                                        setMetadataRatio({
                                                            src: currentMedia.mediaURL,
                                                            ratio: v.videoWidth / v.videoHeight
                                                        })
                                                    }}
                                                    onClick={(e) => e.stopPropagation()}
                                                />
                                            ) : currentMedia.mediaType.startsWith('audio/') ? (
                                                <AudioSlide media={currentMedia} />
                                            ) : currentMedia.mediaType.startsWith('model/') ? (
                                                <div
                                                    // model-viewerのカメラ操作とスワイプが競合しないよう、ここで止めてカルーセルのdragを始めない
                                                    onClick={(e) => e.stopPropagation()}
                                                    onPointerDown={(e) => e.stopPropagation()}
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
                                        </motion.div>
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
                            </LazyMotion>

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

                            {/* ページインジケーター(配列モードは全体、グリッドは元投稿内) */}
                            {dots && (
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
                                    {Array.from({ length: dots.length }, (_, index) => (
                                        <div
                                            key={index}
                                            style={{
                                                width: index === dots.active ? '10px' : '7px',
                                                height: index === dots.active ? '10px' : '7px',
                                                borderRadius: '50%',
                                                backgroundColor:
                                                    index === dots.active ? 'white' : 'rgba(255, 255, 255, 0.4)',
                                                transition: 'all 0.2s ease',
                                                cursor: 'pointer'
                                            }}
                                            onClick={(e) => {
                                                e.stopPropagation()
                                                dots.jump(index)
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
    // HLS は <video> に載せるだけで playlist/segment の取得が走るので、プレビューはサムネイルで代用する
    if (media.mediaType === 'application/vnd.apple.mpegurl') {
        if (!media.thumbnailURL) return <MdPlayCircle size={96} style={{ color: 'rgba(255, 255, 255, 0.8)' }} />
        return (
            <img
                src={media.thumbnailURL}
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
    }
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
