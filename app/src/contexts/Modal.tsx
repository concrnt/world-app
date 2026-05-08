import { AnimatePresence, motion } from 'motion/react'
import { createContext, ReactNode, useCallback, useContext, useMemo, useState } from 'react'
import { CssVar } from '../types/Theme'

export interface ModalOptions {
    description?: ReactNode
    confirmText?: string
    cancelText?: string
}

interface ModalContextState {
    open: (content: ReactNode) => void
    close: () => void
}

interface Props {
    children: React.ReactNode
}

export const ModalContext = createContext<ModalContextState>({
    open: () => {},
    close: () => {}
})

export const ModalProvider = (props: Props) => {
    const [content, setContent] = useState<ReactNode | null>(null)

    const open = useCallback((content: ReactNode) => {
        setContent(content)
    }, [])

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
        <ModalContext.Provider value={value}>
            {props.children}

            <AnimatePresence>
                {content && (
                    <>
                        <motion.div
                            style={{
                                position: 'fixed',
                                top: 0,
                                left: 0,
                                width: '100%',
                                height: '100%',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                backgroundColor: 'black'
                            }}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 0.8 }}
                            exit={{ opacity: 0 }}
                        />
                        <div
                            style={{
                                position: 'fixed',
                                top: 0,
                                left: 0,
                                width: '100%',
                                height: '100%',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                            }}
                        >
                            <motion.div
                                style={{
                                    backgroundColor: CssVar.contentBackground,
                                    padding: CssVar.space(2),
                                    borderRadius: CssVar.round(1),
                                    width: '80vw',
                                    position: 'absolute',
                                    top: '30%'
                                }}
                                initial={{ opacity: 0, scale: 0.8 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.8 }}
                            >
                                {content}
                            </motion.div>
                        </div>
                    </>
                )}
            </AnimatePresence>
        </ModalContext.Provider>
    )
}

export const useModal = (): ModalContextState => {
    return useContext(ModalContext)
}
