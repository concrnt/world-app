import { animate, AnimatePresence, motion, useDragControls, useMotionValue, useTransform } from 'motion/react'
import { createContext, Fragment, ReactNode, useCallback, useContext, useMemo, useState } from 'react'
import { Text, List } from '@concrnt/ui'
import { CssVar } from '../types/Theme'

interface SelectContextState {
    select: (title: string, options: ReactNode[]) => void
    close: () => void
}

interface Props {
    children: React.ReactNode
}

const SelectContext = createContext<SelectContextState>({
    select: (_title: string, _options: ReactNode[]) => {},
    close: () => {}
})

export const SelectProvider = (props: Props) => {
    const y = useMotionValue(0)
    const dragControls = useDragControls()

    const [title, setTitle] = useState<string>('')
    const [options, setSelection] = useState<ReactNode[]>([])

    const height = Object.keys(options).length * 56 + 30 + 48 // Approximate height calculation

    const backdropOpacity = useTransform(y, [0, height], [0.5, 0])

    const close = () => {
        setTitle('')
        setSelection([])
    }

    const select = useCallback((title: string, options: ReactNode[]) => {
        setTitle(title)
        setSelection(options)
    }, [])

    const value = useMemo(
        () => ({
            select,
            close
        }),
        [select, close]
    )

    return (
        <>
            <SelectContext.Provider value={value}>{props.children}</SelectContext.Provider>
            <AnimatePresence>
                {options.length > 0 && (
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
                                backgroundColor: CssVar.contentBackground,
                                color: CssVar.contentText,
                                position: 'absolute',
                                bottom: 0,
                                left: 0,
                                right: 0,
                                paddingBottom: 'env(safe-area-inset-bottom)',
                                borderRadius: `${CssVar.round(1)} ${CssVar.round(1)} 0 0`,
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
                                        backgroundColor: CssVar.divider
                                    }}
                                />
                            </div>
                            {title && (
                                <div
                                    style={{
                                        height: '30px',
                                        borderBottom: `1px solid ${CssVar.divider}`,
                                        padding: `0 ${CssVar.space(2)}`
                                    }}
                                >
                                    <Text>{title}</Text>
                                </div>
                            )}
                            <List style={{ maxHeight: '50vh', overflowY: 'auto' }}>
                                {options.map((opt, i) => (
                                    <Fragment key={i}>{opt}</Fragment>
                                ))}
                            </List>
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
