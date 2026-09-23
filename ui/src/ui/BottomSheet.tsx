import { type ReactNode, useEffect, useRef } from 'react'
import { animate, motion, useDragControls, useMotionValue, useTransform } from 'motion/react'
import { CssVar } from '../types/Theme'

// キーボード分の余白でコンテンツを潰し切らないための下限
const MIN_CONTENT_HEIGHT = 120

interface Props {
    height: number
    onDismiss: () => void | boolean
    keyboardInset?: {
        height: number
        duration: number
    }
    handle?: boolean
    children: ReactNode
}

export const BottomSheet = (props: Props) => {
    const y = useMotionValue(0)
    const dragControls = useDragControls()

    const height = props.height
    const backdropOpacity = useTransform(y, [0, height], [0.5, 0])

    const restorePosition = () => {
        animate(y, 0, { type: 'tween', ease: 'easeOut', duration: 0.2 })
    }

    // 想定外に大きいキーボード高さが来ても、スペーサーがシートを食い尽くして
    // スクロールコンテナが高さ0になる(中身が消える)ことがないようクランプする
    const keyboardHeight = Math.min(props.keyboardInset?.height ?? 0, Math.max(0, height - MIN_CONTENT_HEIGHT))
    const keyboardDuration = props.keyboardInset?.duration ?? 0

    const contentRef = useRef<HTMLDivElement | null>(null)

    // フォーカス時のブラウザ標準スクロールはスペーサーが伸びる前に走るため、
    // 伸び切った後に入力欄がキーボードの裏へ残る。スペーサーの遷移が終わったタイミングで
    // フォーカス中の入力欄をスクロールコンテナ内に収め直す。
    // scrollIntoViewはwindow側まで動かしうるので、入力欄からコンテナまでのスクロール可能な祖先を
    // 個別にscrollTopで調整する(AuthScreen等の内側スクロールもこれで拾える)
    useEffect(() => {
        if (keyboardHeight <= 0) return
        const timer = setTimeout(
            () => {
                const container = contentRef.current
                const active = document.activeElement
                if (!container || !(active instanceof HTMLElement) || !container.contains(active)) return
                const isEditable =
                    active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || active.isContentEditable
                if (!isEditable) return

                const margin = 8
                let node: HTMLElement | null = active.parentElement
                while (node) {
                    const style = getComputedStyle(node)
                    const scrollable =
                        (style.overflowY === 'auto' || style.overflowY === 'scroll') &&
                        node.scrollHeight > node.clientHeight
                    if (scrollable) {
                        const nodeRect = node.getBoundingClientRect()
                        const activeRect = active.getBoundingClientRect()
                        let delta = 0
                        if (activeRect.bottom + margin > nodeRect.bottom) {
                            delta = activeRect.bottom + margin - nodeRect.bottom
                        } else if (activeRect.top - margin < nodeRect.top) {
                            delta = activeRect.top - margin - nodeRect.top
                        }
                        if (delta !== 0) node.scrollBy({ top: delta, behavior: 'smooth' })
                    }
                    if (node === container) break
                    node = node.parentElement
                }
            },
            keyboardDuration * 1000 + 50
        )
        return () => clearTimeout(timer)
    }, [keyboardHeight, keyboardDuration])

    return (
        <>
            <motion.div
                style={{
                    position: 'fixed',
                    inset: 0,
                    background: 'black',
                    opacity: backdropOpacity
                }}
                onClick={() => {
                    const dismissed = props.onDismiss()
                    if (dismissed === false) restorePosition()
                }}
            />
            <motion.div
                style={{
                    backgroundColor: CssVar.contentBackground,
                    color: CssVar.contentText,
                    position: 'absolute',
                    bottom: 0,
                    left: 0,
                    right: 0,
                    paddingBottom: 'env(safe-area-inset-bottom)',
                    borderRadius: `${CssVar.round(1)} ${CssVar.round(1)} 0 0`,
                    height,
                    y,
                    display: 'flex',
                    flexDirection: 'column'
                }}
                drag="y"
                dragControls={dragControls}
                dragListener={false}
                dragConstraints={{ top: 0, bottom: height }}
                dragElastic={0}
                dragMomentum={false}
                initial={{ y: height }}
                animate={{ y: 0 }}
                transition={{ type: 'tween', ease: 'easeOut', duration: 0.2 }}
                exit={{ y: height }}
                onDragEnd={(_, info) => {
                    const current = y.get()
                    const v = info.velocity.y
                    const dy = info.offset.y

                    const fast = Math.abs(v) > 50
                    const far = Math.abs(dy) > height / 2

                    let shouldClose = false
                    if (fast) {
                        shouldClose = v > 0
                    } else if (far) {
                        shouldClose = dy > 0
                    } else {
                        shouldClose = current > height / 2
                    }

                    if (shouldClose) {
                        const dismissed = props.onDismiss()
                        if (dismissed === false) {
                            restorePosition()
                        }
                    } else {
                        restorePosition()
                    }
                }}
            >
                {(props.handle ?? true) && (
                    <div
                        style={{
                            display: 'flex',
                            justifyContent: 'center',
                            padding: `${CssVar.space(2)} 0`,
                            position: 'relative',
                            touchAction: 'none'
                        }}
                        onPointerDown={(e) => {
                            dragControls.start(e)
                        }}
                    >
                        {/* ハンドルの見た目は変えず、当たり判定を縦方向に拡張する透明レイヤー */}
                        <div
                            style={{
                                position: 'absolute',
                                top: `-${CssVar.space(4)}`,
                                bottom: `-${CssVar.space(4)}`,
                                left: 0,
                                right: 0
                            }}
                        />
                        <div
                            style={{
                                width: '30px',
                                height: '6px',
                                borderRadius: CssVar.round(0.5),
                                backgroundColor: CssVar.divider
                            }}
                        />
                    </div>
                )}
                <div
                    ref={contentRef}
                    style={{
                        overflow: 'auto',
                        flex: 1,
                        minHeight: 0
                    }}
                >
                    {props.children}
                </div>
                {props.keyboardInset && (
                    <div
                        style={{
                            flexShrink: 0,
                            // ネイティブから来る高さは画面下端との重なりなのでsafe area分を含んでいる。
                            // シート自体がpaddingBottomでsafe areaを確保しているため、
                            // 引かずに使うとキーボードとの間が二重に空く
                            height: `max(0px, calc(${keyboardHeight}px - env(safe-area-inset-bottom)))`,
                            transition: `height ${props.keyboardInset.duration}s ease-out`
                        }}
                    />
                )}
            </motion.div>
        </>
    )
}
