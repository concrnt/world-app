import { ReactNode, useLayoutEffect, useRef, useState } from 'react'
import { useTheme } from '../contexts/Theme'
import { AnimatePresence, animate, motion, useDragControls, useMotionValue } from 'motion/react'

interface Props {
    open: boolean
    onClose?: () => void
    children?: ReactNode
    style?: React.CSSProperties
    headerLeftElement?: ReactNode
    headerRightElement?: ReactNode
}

export const Drawer = (props: Props) => {
    const theme = useTheme()

    const panelRef = useRef<HTMLDivElement>(null)
    const dragControls = useDragControls()
    const y = useMotionValue(0)
    const [panelHeight, setPanelHeight] = useState(0)

    useLayoutEffect(() => {
        if (!props.open) return

        // 開いた瞬間に高さを測る（80%想定だけど実測）
        const el = panelRef.current
        const h = el?.getBoundingClientRect().height ?? Math.round(window.innerHeight * 0.8)
        setPanelHeight(h)

        // 下から出てくる
        y.set(h)
        animate(y, 0, { type: 'spring', stiffness: 380, damping: 36 })

        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [props.open])

    const close = async () => {
        const h =
            panelRef.current?.getBoundingClientRect().height ?? panelHeight ?? Math.round(window.innerHeight * 0.8)
        // 今の位置から下へ（ドラッグ終端→自然に閉じる）
        await animate(y, h, { type: 'tween', duration: 0.18, ease: 'easeOut' })
        props.onClose?.()
    }

    return (
        <AnimatePresence>
            {props.open && (
                <motion.div
                    style={{
                        position: 'fixed',
                        inset: 0,
                        zIndex: 9999
                    }}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                >
                    {/* Backdrop */}
                    <motion.div
                        style={{
                            position: 'absolute',
                            inset: 0,
                            background: 'rgba(0,0,0,0.45)'
                        }}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={() => {
                            void close()
                        }}
                    />

                    {/* Panel */}
                    <motion.div
                        ref={panelRef}
                        onClick={(e) => e.stopPropagation()} // backdrop クリックを遮断
                        style={{
                            width: '100%',
                            height: '80%',
                            display: 'flex',
                            flexDirection: 'column',
                            color: theme.content.text,
                            backgroundColor: theme.content.background,
                            position: 'absolute',
                            left: 0,
                            right: 0,
                            bottom: 0,
                            borderTopLeftRadius: 12,
                            borderTopRightRadius: 12,
                            y, // 指に追従
                            paddingBottom: 'env(safe-area-inset-bottom)',
                            boxShadow: '0 -12px 40px rgba(0,0,0,0.25)',
                            touchAction: 'none' // パネル全体はドラッグさせない（dragListener=falseなので安全）
                        }}
                        // ドラッグは “許可” だけしておいて、開始はハンドルから
                        drag="y"
                        dragControls={dragControls}
                        dragListener={false}
                        dragConstraints={{ top: 0, bottom: panelHeight || 10000 }}
                        dragElastic={{ top: 0, bottom: 0.25 }}
                        onDragEnd={(_, info) => {
                            const h = panelRef.current?.getBoundingClientRect().height ?? panelHeight ?? 0
                            const shouldClose = info.offset.y > h * 0.25 || info.velocity.y > 1000

                            if (shouldClose) {
                                void close()
                            } else {
                                animate(y, 0, { type: 'spring', stiffness: 380, damping: 36 })
                            }
                        }}
                        initial={{ y: '100%' }}
                        animate={{ y: 0 }}
                        exit={{ y: '100%' }}
                        transition={{ type: 'spring', stiffness: 380, damping: 36 }}
                    >
                        {/* Handle: ここを触ったときだけ閉じる動きに追従 */}
                        <div
                            style={{
                                display: 'grid',
                                gridTemplateColumns: '1fr 1fr 1fr',
                                margin: '7px 0',
                                width: '100%',
                                padding: '0 7px'
                            }}
                            onPointerDown={(e) => {
                                dragControls.start(e)
                            }}
                        >
                            <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                                {props.headerLeftElement}
                            </div>
                            <div
                                style={{
                                    display: 'flex',
                                    justifyContent: 'center',
                                    alignItems: 'center'
                                }}
                            >
                                <div
                                    style={{
                                        width: '30px',
                                        height: '6px',
                                        borderRadius: '3px',
                                        backgroundColor: theme.divider
                                    }}
                                />
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                                {props.headerRightElement}
                            </div>
                        </div>

                        {/* Content: 個別スクロールOK */}
                        <div
                            style={{
                                flex: 1,
                                overflowY: 'auto',
                                width: '100%',
                                WebkitOverflowScrolling: 'touch',
                                touchAction: 'pan-y', // ここはスクロール優先
                                ...props.style
                            }}
                        >
                            {props.children}
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    )
}
