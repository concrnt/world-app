import { useEffect, useState } from 'react'
import { Button } from '../ui/Button'
import { useClient } from '../contexts/Client'
import { AnimatePresence, motion } from 'motion/react'
import { Schemas } from '@concrnt/worldlib'
import { TimelinePicker } from './TimelinePicker'
import { Timeline } from '@concrnt/worldlib'
import { useTheme } from '../contexts/Theme'

interface Props {
    onClose?: () => void
}

export const Composer = (props: Props) => {
    const { client } = useClient()
    const [willClose, setWillClose] = useState<boolean>(false)
    const [draft, setDraft] = useState<string>('')
    const [destinations, setDestinations] = useState<string[]>([])

    const theme = useTheme()

    const [viewportHeight, setViewportHeight] = useState<number>(visualViewport?.height ?? 0)
    useEffect(() => {
        function handleResize(): void {
            setViewportHeight(visualViewport?.height ?? 0)
        }
        visualViewport?.addEventListener('resize', handleResize)
        return () => visualViewport?.removeEventListener('resize', handleResize)
    }, [])

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
                        backgroundColor: theme.ui.background,
                        position: 'absolute',
                        left: 0,
                        zIndex: 1001,
                        display: 'flex',
                        flexDirection: 'column',
                        paddingTop: 'env(safe-area-inset-top)'
                    }}
                    //initial={{ top: '100%' }}
                    //animate={{ top: 0 }}
                    //exit={{ top: '100%' }}
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
                            maxHeight: '50vh'
                        }}
                    >
                        <div>
                            <Button
                                variant="text"
                                onClick={() => {
                                    setWillClose(true)
                                }}
                                style={{
                                    color: theme.ui.text
                                }}
                            >
                                cancel
                            </Button>
                        </div>
                        <div
                            style={{
                                backgroundColor: theme.content.background,
                                width: '100%',
                                height: '100%',
                                flex: 1,
                                display: 'flex',
                                flexDirection: 'column',
                                padding: '8px',
                                gap: '8px'
                            }}
                        >
                            <div>
                                <TimelinePicker
                                    items={client?.home?.communities ?? []}
                                    selected={destinations}
                                    setSelected={setDestinations}
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
                                        background: 'transparent'
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
                                                `cc://${client.ccid}/concrnt.world/main/home-timeline`,
                                                ...destinations
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
