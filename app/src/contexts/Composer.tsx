import { Composer } from '../components/Composer'
import { createContext, useCallback, useContext, useMemo, useState } from 'react'
import { Message } from '@concrnt/worldlib'

export type ComposerMode = 'normal' | 'reply' | 'reroute'

interface ComposerContextState {
    open: (destinations: string[], options: any[], mode?: ComposerMode, targetMessage?: Message<any>) => void
    close: () => void
    setCommunityOptions: (options: any[]) => void
}

interface Props {
    children: React.ReactNode
}

const ComposerContext = createContext<ComposerContextState>({
    open: () => {},
    close: () => {},
    setCommunityOptions: () => {}
})

export const ComposerProvider = (props: Props) => {
    const [showComposer, setShowComposer] = useState(false)
    const [destinations, setDestinations] = useState<string[]>([])
    const [options, setOptions] = useState<any[]>([])
    const [mode, setMode] = useState<ComposerMode>('normal')
    const [targetMessage, setTargetMessage] = useState<Message<any> | undefined>(undefined)
    const [communityOptions, _setCommunityOptions] = useState<any[]>([])

    const setCommunityOptions = useCallback((options: any[]) => {
        _setCommunityOptions(options)
    }, [])

    const open = useCallback(
        (destinations: string[], options: any[], mode?: ComposerMode, targetMessage?: Message<any>) => {
            setDestinations(destinations)
            // options が空の場合は保持済みの communityOptions にフォールバック
            setOptions(options.length > 0 ? options : communityOptions)
            setMode(mode ?? 'normal')
            setTargetMessage(targetMessage)
            setShowComposer(true)
        },
        [communityOptions]
    )

    const close = useCallback(() => {
        setShowComposer(false)
        setMode('normal')
        setTargetMessage(undefined)
    }, [])

    const value = useMemo(
        () => ({
            open,
            close,
            setCommunityOptions
        }),
        [open, close, setCommunityOptions]
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
                        <Composer
                            onClose={() => setShowComposer(false)}
                            destinations={destinations}
                            setDestinations={setDestinations}
                            options={options}
                            mode={mode}
                            targetMessage={targetMessage}
                        />
                    </div>
                )}
            </div>
        </ComposerContext.Provider>
    )
}

export const useComposer = () => {
    return useContext(ComposerContext)
}
