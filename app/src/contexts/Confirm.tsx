import { AnimatePresence, motion } from 'motion/react'
import { createContext, ReactNode, useCallback, useContext, useMemo, useState } from 'react'
import { CssVar } from '../types/Theme'
import { Button } from '@concrnt/ui'

export interface ConfirmOptions {
    description?: ReactNode
    confirmText?: string
    cancelText?: string
}

interface ConfirmContextState {
    open: (title: string, onConfirm: () => void, opts?: ConfirmOptions) => void
}

interface Props {
    children: React.ReactNode
}

const ConfirmContext = createContext<ConfirmContextState>({
    open: () => {}
})

export const ConfirmProvider = (props: Props) => {
    const [title, setTitle] = useState<string | null>(null)
    const [opts, setOpts] = useState<ConfirmOptions | null>(null)
    const [onConfirm, setOnConfirm] = useState<() => void>(() => () => {})

    const open = useCallback((title: string, onConfirm: () => void, opts?: ConfirmOptions) => {
        setTitle(title)
        setOnConfirm(() => onConfirm)
        setOpts(opts ?? null)
    }, [])

    const close = useCallback(() => {
        setTitle(null)
        setOnConfirm(() => () => {})
        setOpts(null)
    }, [])

    const value = useMemo(
        () => ({
            open
        }),
        [open]
    )

    return (
        <ConfirmContext.Provider value={value}>
            {props.children}

            <AnimatePresence>
                {title && (
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
                                <h2>{title}</h2>
                                {opts?.description && <p>{opts.description}</p>}
                                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: CssVar.space(1) }}>
                                    <Button onClick={close}>{opts?.cancelText ?? 'Cancel'}</Button>
                                    <Button
                                        onClick={() => {
                                            onConfirm()
                                            close()
                                        }}
                                    >
                                        {opts?.confirmText ?? 'Confirm'}
                                    </Button>
                                </div>
                            </motion.div>
                        </div>
                    </>
                )}
            </AnimatePresence>
        </ConfirmContext.Provider>
    )
}

export const useConfirm = (): ConfirmContextState => {
    return useContext(ConfirmContext)
}
