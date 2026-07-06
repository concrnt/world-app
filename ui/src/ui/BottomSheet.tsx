import { type ReactNode } from 'react'
import { animate, motion, useDragControls, useMotionValue, useTransform } from 'motion/react'
import { CssVar } from '../types/Theme'

interface Props {
    height: number
    onDismiss: () => void
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
                    props.onDismiss()
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
                        props.onDismiss()
                    } else {
                        animate(y, 0, { type: 'tween', ease: 'easeOut', duration: 0.2 })
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
                            height: `${props.keyboardInset.height}px`,
                            transition: `height ${props.keyboardInset.duration}s ease-out`
                        }}
                    />
                )}
            </motion.div>
        </>
    )
}
