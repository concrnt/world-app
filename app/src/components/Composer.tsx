import { useEffect, useState } from 'react'
import { Button } from '@concrnt/ui'
import { useClient } from '../contexts/Client'
import { AnimatePresence, motion } from 'motion/react'
import { Schemas } from '@concrnt/worldlib'
import { TimelinePicker } from './TimelinePicker'
import { Timeline } from '@concrnt/worldlib'
import { useTheme } from '../contexts/Theme'
import { useLocalStorage } from '../hooks/useLocalStorage'
import { CssVar } from '../types/Theme'

interface Props {
    onClose?: () => void
    destinations: string[]
    setDestinations: (destinations: string[]) => void
    options: any[]
}

export const Composer = (props: Props) => {
    const { client } = useClient()
    const [willClose, setWillClose] = useState<boolean>(false)
    const [draft, setDraft] = useState<string>('')
    const [postHome, setPostHome] = useState<boolean>(true)

    const theme = useTheme()

    const [viewportHeight, setViewportHeight] = useLocalStorage<number>(
        'composerViewportHeight',
        visualViewport?.height ?? 0
    )
    useEffect(() => {
        function handleResize(): void {
            setViewportHeight(visualViewport?.height ?? 0)
        }
        visualViewport?.addEventListener('resize', handleResize)
        return () => visualViewport?.removeEventListener('resize', handleResize)
    }, [setViewportHeight])

    return (
        <AnimatePresence
            onExitComplete={() => {
                setDraft('')
                props.onClose?.()
            }}
        >
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
                            height: `calc(${viewportHeight}px - env(safe-area-inset-top))`,
                            display: 'flex',
                            flexDirection: 'column',
                            maxHeight: '50vh',
                            transition: 'height 0.1s ease-in-out'
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
                                    theme.variant === 'classic' ? undefined : `${CssVar.space(2)} ${CssVar.space(2)} 0`
                            }}
                        >
                            <div>
                                <TimelinePicker
                                    items={props.options}
                                    selected={props.destinations}
                                    setSelected={props.setDestinations}
                                    keyFunc={(item: Timeline) => item.uri}
                                    labelFunc={(item: Timeline) => item.name}
                                    postHome={postHome}
                                    setPostHome={setPostHome}
                                />
                            </div>
                            <div
                                style={{
                                    flex: 1
                                }}
                            >
                                <textarea
                                    autoFocus
                                    value={draft}
                                    placeholder="いま、なにしてる？"
                                    onChange={(e) => setDraft(e.target.value)}
                                    style={{
                                        width: '100%',
                                        fontSize: '1.5rem',
                                        boxSizing: 'border-box',
                                        border: 'none',
                                        outline: 'none',
                                        resize: 'none',
                                        height: '100%',
                                        background: 'transparent',
                                        color: CssVar.contentText
                                    }}
                                />
                            </div>
                        </div>
                        <div
                            style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                padding: CssVar.space(2)
                            }}
                        >
                            <Button
                                variant="text"
                                onClick={() => {
                                    setWillClose(true)
                                }}
                                style={{
                                    color: CssVar.backdropText
                                }}
                            >
                                キャンセル
                            </Button>
                            <Button
                                onClick={async () => {
                                    if (!client) return

                                    const homeTimeline = `cckv://${client.ccid}/concrnt.world/main/home-timeline`
                                    const distributes = [...(postHome ? [homeTimeline] : []), ...props.destinations]

                                    const document = {
                                        key: '/concrnt.world/main/posts/{cdid}',
                                        schema: Schemas.markdownMessage,
                                        value: {
                                            body: draft
                                        },
                                        author: client.ccid,
                                        distributes,
                                        createdAt: new Date()
                                    }
                                    client.api.commit(document).then(() => {
                                        setWillClose(true)
                                    })
                                }}
                            >
                                投稿
                            </Button>
                        </div>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    )
}
