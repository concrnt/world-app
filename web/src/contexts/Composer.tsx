/* eslint-disable react-refresh/only-export-components */
import type { ReactNode } from 'react'
import { createContext, useCallback, useContext, useMemo, useState } from 'react'
import type { Message } from '@concrnt/worldlib'
import { Composer } from '../components/Composer'
import { Modal } from '../components/Modal'

export type ComposerMode = 'normal' | 'reply' | 'reroute'

interface ComposerContextState {
    open: (mode?: ComposerMode, targetMessage?: Message<unknown>) => void
    close: () => void
    setAdditionalDestinations: (destinations: string[]) => void
}

const ComposerContext = createContext<ComposerContextState>({
    open: () => {},
    close: () => {},
    setAdditionalDestinations: () => {}
})

export const ComposerProvider = (props: { children: ReactNode }) => {
    const [isOpen, setIsOpen] = useState(false)
    const [additionalDestinations, setAdditionalDestinations] = useState<string[]>([])
    const [mode, setMode] = useState<ComposerMode>('normal')
    const [targetMessage, setTargetMessage] = useState<Message<unknown> | undefined>(undefined)
    const [seed, setSeed] = useState(0)

    const open = useCallback((nextMode: ComposerMode = 'normal', nextTargetMessage?: Message<unknown>) => {
        setMode(nextMode)
        setTargetMessage(nextTargetMessage)
        setSeed((value) => value + 1)
        setIsOpen(true)
    }, [])

    const close = useCallback(() => {
        setIsOpen(false)
        setMode('normal')
        setTargetMessage(undefined)
    }, [])

    const value = useMemo(
        () => ({
            open,
            close,
            setAdditionalDestinations
        }),
        [open, close]
    )

    return (
        <ComposerContext.Provider value={value}>
            {props.children}
            {isOpen && (
                <Modal title={mode === 'reply' ? 'Reply' : mode === 'reroute' ? 'Reroute' : 'New Post'} onClose={close}>
                    <Composer
                        key={seed}
                        initialDestinations={additionalDestinations}
                        mode={mode}
                        targetMessage={targetMessage}
                        onPosted={close}
                    />
                </Modal>
            )}
        </ComposerContext.Provider>
    )
}

export const useComposerLauncher = () => {
    return useContext(ComposerContext)
}
