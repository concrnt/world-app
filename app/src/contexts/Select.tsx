import { animate, AnimatePresence, motion, useDragControls, useMotionValue, useTransform } from 'motion/react'
import { createContext, ReactNode, useCallback, useContext, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useTheme } from './Theme'
import { Text } from '../ui/Text'

interface SelectContextState {
    select: (title: string, options: Record<string, ReactNode>, callback: (selected: string) => void) => void
}

interface Props {
    children: React.ReactNode
}

const SelectContext = createContext<SelectContextState>({
    select: (_title: string, _options: Record<string, ReactNode>, _callback: (selected: string) => void) => {}
})

export const SelectProvider = (props: Props) => {
    const theme = useTheme()

    const y = useMotionValue(0)
    const dragControls = useDragControls()

    const [title, setTitle] = useState<string>('')
    const [selection, setSelection] = useState<Record<string, ReactNode> | undefined>(undefined)
    const [callback, setCallback] = useState<((selected: string) => void) | undefined>(undefined)

    const sheetRef = useRef<HTMLDivElement>(null)
    const [sheetH, setSheetH] = useState(0)
    const measured = sheetH > 0

    // ResizeObserver でシート実寸を追従 (ui-scale / viewport / font-load 変動を捕捉)
    useLayoutEffect(() => {
        const el = sheetRef.current
        if (!el || !selection) return

        let first = true
        const update = () => {
            const h = el.offsetHeight
            setSheetH(h)
            if (first) {
                y.set(h)
                first = false
            }
        }
        update() // 初回同期測定

        const ro = new ResizeObserver(update)
        ro.observe(el)

        const onResize = () => update()
        window.addEventListener('resize', onResize) // iOS viewport 変動対策

        return () => {
            ro.disconnect()
            window.removeEventListener('resize', onResize)
            setSheetH(0)
        }
    }, [selection, y])

    const backdropOpacity = useTransform(y, [0, sheetH || 1], [0.5, 0])

    const close = () => {
        setTitle('')
        setSelection(undefined)
        setCallback(undefined)
    }

    const select = useCallback(
        (title: string, options: Record<string, ReactNode>, callback: (selected: string) => void) => {
            setTitle(title)
            setSelection(options)
            setCallback(() => callback)
        },
        []
    )

    const value = useMemo(
        () => ({
            select
        }),
        [select]
    )

    return (
        <>
            <SelectContext.Provider value={value}>{props.children}</SelectContext.Provider>
            <AnimatePresence>
                {selection && (
                    <>
                        <motion.div
                            style={{
                                position: 'absolute',
                                inset: 0,
                                background: 'black',
                                opacity: backdropOpacity
                            }}
                            onClick={() => {
                                close()
                            }}
                        />
                        <motion.div
                            ref={sheetRef}
                            style={{
                                backgroundColor: theme.content.background,
                                color: theme.content.text,
                                position: 'absolute',
                                bottom: 0,
                                left: 0,
                                right: 0,
                                paddingBottom: 'env(safe-area-inset-bottom)',
                                borderRadius: 'var(--radius-lg) var(--radius-lg) 0 0',
                                y,
                                visibility: measured ? 'visible' : 'hidden'
                            }}
                            drag={measured ? 'y' : false}
                            dragControls={dragControls}
                            dragListener={false}
                            dragConstraints={{ top: 0, bottom: sheetH }}
                            dragElastic={0}
                            dragMomentum={false}
                            animate={measured ? { y: 0 } : false}
                            transition={{ type: 'tween', ease: 'easeOut', duration: 0.2 }}
                            exit={{ y: sheetH }}
                            onDragEnd={(_, info) => {
                                const current = y.get()
                                const v = info.velocity.y
                                const dy = info.offset.y

                                const fast = Math.abs(v) > 50
                                const far = Math.abs(dy) > sheetH / 2

                                let shouldClose = false
                                if (fast) {
                                    shouldClose = v > 0
                                } else if (far) {
                                    shouldClose = dy > 0
                                } else {
                                    shouldClose = current > sheetH / 2
                                }

                                if (shouldClose) {
                                    close()
                                } else {
                                    animate(y, 0, { type: 'tween', ease: 'easeOut', duration: 0.2 })
                                }
                            }}
                        >
                            <div
                                style={{
                                    display: 'flex',
                                    justifyContent: 'center',
                                    alignItems: 'center',
                                    height: 'var(--sheet-handle-area-h)'
                                }}
                                onPointerDown={(e) => {
                                    dragControls.start(e)
                                }}
                            >
                                <div
                                    style={{
                                        width: 'var(--sheet-handle-bar-w)',
                                        height: 'var(--sheet-handle-bar-h)',
                                        borderRadius: 'var(--sheet-handle-bar-radius)',
                                        backgroundColor: theme.divider
                                    }}
                                />
                            </div>
                            {title && (
                                <div
                                    style={{
                                        height: 'var(--sheet-title-h)',
                                        borderBottom: `1px solid ${theme.divider}`
                                    }}
                                >
                                    <Text>{title}</Text>
                                </div>
                            )}
                            <div style={{ maxHeight: '50vh', overflowY: 'auto' }}>
                                {Object.keys(selection).map((key) => (
                                    <div
                                        key={key}
                                        style={{
                                            padding: 'var(--space-3)',
                                            height: 'var(--select-item-h)',
                                            borderBottom: `1px solid ${theme.divider}`
                                        }}
                                        onClick={() => {
                                            if (callback) {
                                                callback(key)
                                            }
                                            close()
                                        }}
                                    >
                                        {selection[key]}
                                    </div>
                                ))}
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </>
    )
}

export const useSelect = (): SelectContextState => {
    return useContext(SelectContext)
}
