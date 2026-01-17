import { Composer } from '../components/Composer'
import { createContext, useCallback, useContext, useMemo, useState } from 'react'

interface ComposerContextState {
    open: () => void
    close: () => void
}

interface Props {
    children: React.ReactNode
}

const ComposerContext = createContext<ComposerContextState>({
    open: () => {},
    close: () => {}
})

export const ComposerProvider = (props: Props) => {
    const [showComposer, setShowComposer] = useState(false)

    const open = useCallback(() => {
        console.log('Opening composer')
        setShowComposer(true)
    }, [])

    const close = useCallback(() => {
        setShowComposer(false)
    }, [])

    const value = useMemo(
        () => ({
            open,
            close
        }),
        [open, close]
    )

    return (
        <ComposerContext.Provider value={value}>
            <div
                style={{
                    width: '100%',
                    height: '100%',
                    position: 'relative',
                    overflow: 'hidden'
                }}
            >
                <div
                    style={{
                        width: '100%',
                        height: '100%',
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        overflow: 'hidden'
                    }}
                >
                    {props.children}
                </div>
                {showComposer && (
                    <div
                        style={{
                            width: '100%',
                            height: '100%',
                            position: 'absolute',
                            top: 0,
                            left: 0
                        }}
                    >
                        <Composer onClose={() => setShowComposer(false)} />
                    </div>
                )}
            </div>
        </ComposerContext.Provider>
    )
}

export const useComposer = () => {
    return useContext(ComposerContext)
}
