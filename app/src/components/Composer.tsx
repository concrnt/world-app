import { useEffect, useState } from 'react'
import { Button } from '../ui/Button'
import { useClient } from '../contexts/Client'
import { AnimatePresence, motion } from 'motion/react'
import { Schemas } from '@concrnt/worldlib'
import { TimelinePicker } from './TimelinePicker'
import { Timeline } from '@concrnt/worldlib'
import { useTheme } from '../contexts/Theme'
import { useLocalStorage } from '../hooks/useLocalStorage'

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
                        backgroundColor: theme.backdrop.background,
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
                        <div>
                            <Button
                                variant="text"
                                onClick={() => {
                                    setWillClose(true)
                                }}
                                style={{
                                    color: theme.backdrop.text
                                }}
                            >
                                キャンセル
                            </Button>
                        </div>
                        <div
                            style={{
                                backgroundColor: theme.content.background,
                                flex: 1,
                                display: 'flex',
                                flexDirection: 'column',
                                padding: '8px',
                                gap: '8px',
                                borderRadius: theme.variant === 'classic' ? undefined : '8px',
                                margin: theme.variant === 'classic' ? undefined : '0 8px'
                            }}
                        >
                            <div>
                                <TimelinePicker
                                    items={props.options}
                                    selected={props.destinations}
                                    setSelected={props.setDestinations}
                                    keyFunc={(item: Timeline) => item.uri}
                                    labelFunc={(item: Timeline) => item.name}
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
                                        fontSize: '16px',
                                        boxSizing: 'border-box',
                                        border: 'none',
                                        outline: 'none',
                                        resize: 'none',
                                        height: '100%',
                                        background: 'transparent',
                                        color: theme.content.text
                                    }}
                                />
                            </div>
                            <div
                                style={{
                                    display: 'flex',
                                    justifyContent: 'flex-end'
                                }}
                            >
                                <Button
                                    onClick={async () => {
                                        if (!client) return
                                        const document = {
                                            key: '/concrnt.world/main/posts/{cdid}',
                                            schema: Schemas.markdownMessage,
                                            value: {
                                                body: draft
                                            },
                                            author: client.ccid,
                                            memberOf: [
                                                `cckv://${client.ccid}/concrnt.world/main/home-timeline`,
                                                ...props.destinations
                                            ],
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
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    )
}
