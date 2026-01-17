import { animate, AnimatePresence, motion, useDragControls, useMotionValue, useTransform } from 'motion/react'
import { createContext, ReactNode, useCallback, useContext, useMemo, useState } from 'react'
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

    const height = Object.keys(selection ?? {}).length * 56 + 30 + 48 // Approximate height calculation

    const backdropOpacity = useTransform(y, [0, height], [0.5, 0])

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
                            style={{
                                backgroundColor: theme.content.background,
                                position: 'absolute',
                                bottom: 0,
                                left: 0,
                                right: 0,
                                paddingBottom: 'env(safe-area-inset-bottom)',
                                borderRadius: '16px 16px 0 0',
                                y
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
                                    padding: '12px 0'
                                }}
                                onPointerDown={(e) => {
                                    dragControls.start(e)
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
                            <div
                                style={{
                                    height: '30px',
                                    borderBottom: `1px solid ${theme.divider}`
                                }}
                            >
                                <Text>{title}</Text>
                            </div>
                            <div style={{ maxHeight: '50vh', overflowY: 'auto' }}>
                                {Object.keys(selection).map((key) => (
                                    <div
                                        key={key}
                                        style={{
                                            padding: '16px',
                                            height: '56px',
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
