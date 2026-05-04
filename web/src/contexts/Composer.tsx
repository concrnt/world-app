/* eslint-disable react-refresh/only-export-components */
import type { ReactNode } from 'react'
import { createContext, useCallback, useContext, useMemo, useState } from 'react'
import { Button, CssVar, Text } from '@concrnt/ui'
import { Composer } from '../components/Composer'

interface ComposerContextState {
    open: () => void
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

    const open = useCallback(() => {
        setIsOpen(true)
    }, [])

    const close = useCallback(() => {
        setIsOpen(false)
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
                <div
                    onClick={close}
                    style={{
                        position: 'fixed',
                        inset: 0,
                        zIndex: 1000,
                        display: 'flex',
                        justifyContent: 'center',
                        alignItems: 'center',
                        padding: CssVar.space(4),
                        backgroundColor: 'rgba(0, 0, 0, 0.4)'
                    }}
                >
                    <div
                        onClick={(event) => event.stopPropagation()}
                        style={{
                            width: '100%',
                            maxWidth: '720px',
                            maxHeight: 'min(80dvh, 720px)',
                            display: 'flex',
                            flexDirection: 'column',
                            borderRadius: CssVar.round(1),
                            overflow: 'hidden',
                            color: CssVar.contentText,
                            backgroundColor: CssVar.contentBackground
                        }}
                    >
                        <div
                            style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                padding: CssVar.space(3),
                                color: CssVar.uiText,
                                backgroundColor: CssVar.uiBackground,
                                borderBottom: `1px solid ${CssVar.divider}`
                            }}
                        >
                            <Text style={{ color: CssVar.uiText }}>New Post</Text>
                            <Button onClick={close}>閉じる</Button>
                        </div>
                        <Composer additionalDestinations={additionalDestinations} onPosted={close} />
                    </div>
                </div>
            )}
        </ComposerContext.Provider>
    )
}

export const useComposerLauncher = () => {
    return useContext(ComposerContext)
}
