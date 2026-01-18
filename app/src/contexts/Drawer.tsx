import { AnimatePresence, motion, useDragControls, useMotionValue, useTransform } from 'motion/react'
import { createContext, ReactNode, useCallback, useContext, useMemo, useState } from 'react'
import { useTheme } from './Theme'
import { animate } from 'motion'

interface DrawerContextState {
    open: (content: ReactNode) => void
    close: () => void
}

interface Props {
    children: React.ReactNode
}

const DrawerContext = createContext<DrawerContextState>({
    open: () => {},
    close: () => {}
})

export const DrawerProvider = (props: Props) => {
    const theme = useTheme()

    const y = useMotionValue(0)
    const dragControls = useDragControls()

    const [content, setContent] = useState<ReactNode>(null)

    const height = window.innerHeight * 0.8
    const backdropOpacity = useTransform(y, [0, height], [0.5, 0])

    const open = useCallback(
        (c: ReactNode) => {
            y.set(height)
            setContent(c)
        },
        [height, y]
    )

    const close = useCallback(() => {
        setContent(null)
    }, [])

    const value = useMemo(
        () => ({
            open,
            close
        }),
        [open, close]
    )

    return (
        <>
            <DrawerContext.Provider value={value}>{props.children}</DrawerContext.Provider>
            <AnimatePresence>
                {content && (
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
                                color: theme.content.text,
                                position: 'absolute',
                                bottom: 0,
                                left: 0,
                                right: 0,
                                paddingBottom: 'env(safe-area-inset-bottom)',
                                borderRadius: '16px 16px 0 0',
                                height,
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
                            {content}
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </>
    )
}

export const useDrawer = (): DrawerContextState => {
    return useContext(DrawerContext)
}
