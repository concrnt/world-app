import { AnimatePresence, motion, useMotionValue, useTransform } from 'motion/react'
import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { CssVar } from '../types/Theme'

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
    const x = useMotionValue(0)

    const [content, setContent] = useState<ReactNode>(null)

    const width = Math.min(window.innerWidth, 420)
    const backdropOpacity = useTransform(x, [0, width], [0.5, 0])

    const open = useCallback(
        (c: ReactNode) => {
            x.set(width)
            setContent(c)
        },
        [width, x]
    )

    const close = useCallback(() => {
        setContent(null)
    }, [])

    useEffect(() => {
        if (!content) return

        const prev = (window as any).__concrntHandleBack
        ;(window as any).__concrntHandleBack = (): boolean => {
            close()
            return true
        }
        return () => {
            ;(window as any).__concrntHandleBack = prev
        }
    }, [content, close])

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
                    <motion.div
                        style={{
                            position: 'fixed',
                            inset: 0,
                            overflow: 'hidden'
                        }}
                    >
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
                                top: 0,
                                right: 0,
                                bottom: 0,
                                paddingRight: 'env(safe-area-inset-right)',
                                borderRadius: `${CssVar.round(1)} 0 0 ${CssVar.round(1)}`,
                                width,
                                maxWidth: '100vw',
                                x,
                                display: 'flex',
                                flexDirection: 'column'
                            }}
                            initial={{ x: width }}
                            animate={{ x: 0 }}
                            transition={{ type: 'tween', ease: 'easeOut', duration: 0.2 }}
                            exit={{ x: width }}
                        >
                            <div
                                style={{
                                    padding: `0 ${CssVar.space(4)}`,
                                    flex: 1,
                                    display: 'flex',
                                    minHeight: 0
                                }}
                            >
                                {content}
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </>
    )
}

export const useDrawer = (): DrawerContextState => {
    return useContext(DrawerContext)
}
