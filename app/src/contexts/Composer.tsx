import { Composer } from '../components/Composer'
import { createContext, useCallback, useContext, useMemo, useState } from 'react'
import { Message, Timeline } from '@concrnt/worldlib'
import { AnimatePresence, motion } from 'motion/react'
import { Button, Divider, useTheme } from '@concrnt/ui'
import { useClient } from './Client'
import { useSubscribe } from '../hooks/useSubscribe'
import { CssVar } from '../types/Theme'
import { useKeyboard } from './Keyboard'

export type ComposerMode = 'normal' | 'reply' | 'reroute'

export type EditorMode = 'plaintext' | 'markdown' | 'media'

export interface DraftBuffer {
    draftText: string
    mediaDrafts: Array<{ file: File }>
    emojiDict: Record<string, { imageURL: string }>
    postHome: boolean
    editorMode?: EditorMode
}

interface ComposerContextState {
    open: (
        destinations: string[],
        options?: Timeline[],
        mode?: ComposerMode,
        targetMessage?: Message<any>,
        profile?: string
    ) => void
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
    const { client } = useClient()

    const [showComposer, setShowComposer] = useState(false)
    const [destinations, setDestinations] = useState<string[]>([])
    const [options, setOptions] = useState<Timeline[]>([])
    const [mode, setMode] = useState<ComposerMode>('normal')
    const [targetMessage, setTargetMessage] = useState<Message<any> | undefined>(undefined)
    const [profile, setProfile] = useState<string | undefined>(undefined)
    const [draftBuffer, setDraftBuffer] = useState<DraftBuffer | null>(null)

    const [knownCommunities] = useSubscribe(client.knownCommunities)

    const open = useCallback(
        (
            destinations: string[],
            options?: Timeline[],
            mode?: ComposerMode,
            targetMessage?: Message<any>,
            profile?: string
        ) => {
            setDestinations(destinations)
            setOptions(options ?? knownCommunities)
            setMode(mode ?? 'normal')
            setTargetMessage(targetMessage)
            setProfile(profile)
            setShowComposer(true)
        },
        [client, knownCommunities]
    )

    const close = useCallback(() => {
        setShowComposer(false)
        setMode('normal')
        setTargetMessage(undefined)
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
                        <ComposerOverlay
                            destinations={destinations}
                            setDestinations={setDestinations}
                            options={options}
                            mode={mode}
                            targetMessage={targetMessage}
                            draftBuffer={mode === 'normal' ? draftBuffer : null}
                            onSaveDraft={mode === 'normal' ? setDraftBuffer : undefined}
                            initialProfile={profile}
                            onClosed={close}
                        />
                    </div>
                )}
            </div>
        </ComposerContext.Provider>
    )
}

// 全画面モーダルのchrome（背景・アニメーション・キャンセルボタン）を担当し、中身はComposerに任せる
const ComposerOverlay = (props: {
    destinations: string[]
    setDestinations: (destinations: string[]) => void
    options: Timeline[]
    mode: ComposerMode
    targetMessage?: Message<any>
    draftBuffer?: DraftBuffer | null
    onSaveDraft?: (buf: DraftBuffer) => void
    initialProfile?: string
    onClosed: () => void
}) => {
    const [willClose, setWillClose] = useState(false)
    const theme = useTheme()

    const keyboard = useKeyboard()

    return (
        <AnimatePresence onExitComplete={props.onClosed}>
            {!willClose && (
                <motion.div
                    style={{
                        width: '100%',
                        height: '100%',
                        backgroundColor: CssVar.backdropBackground,
                        display: 'flex',
                        flexDirection: 'column',
                        paddingTop: 'env(safe-area-inset-top)'
                    }}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.1 }}
                >
                    <div
                        style={{
                            height: `calc(100dvh - ${keyboard.height}px - env(safe-area-inset-top))`,
                            display: 'flex',
                            flexDirection: 'column',
                            maxHeight: '50vh',
                            transition: `height ${keyboard.duration || 0.1}s ease-out`
                        }}
                    >
                        <div
                            style={{
                                backgroundColor: CssVar.contentBackground,
                                flex: 1,
                                display: 'flex',
                                flexDirection: 'column',
                                padding: CssVar.space(2),
                                gap: CssVar.space(2),
                                borderRadius: theme.variant === 'classic' ? undefined : CssVar.round(1),
                                margin:
                                    theme.variant === 'classic' ? undefined : `${CssVar.space(2)} ${CssVar.space(2)} 0`,
                                overflow: 'auto'
                            }}
                        >
                            <div style={{ display: 'flex', alignItems: 'center' }}>
                                <Button
                                    variant="text"
                                    onClick={() => setWillClose(true)}
                                    style={{
                                        fontSize: '0.9rem',
                                        padding: 0
                                    }}
                                >
                                    キャンセル
                                </Button>
                            </div>

                            <Divider />

                            <Composer
                                autoFocus
                                destinations={props.destinations}
                                setDestinations={props.setDestinations}
                                options={props.options}
                                mode={props.mode}
                                targetMessage={props.targetMessage}
                                draftBuffer={props.draftBuffer}
                                onSaveDraft={props.onSaveDraft}
                                initialProfile={props.initialProfile}
                                onPost={() => setWillClose(true)}
                            />
                        </div>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    )
}

export const useComposer = () => {
    return useContext(ComposerContext)
}
