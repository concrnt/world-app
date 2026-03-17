import { useEffect, useState } from 'react'
import { Button } from '@concrnt/ui'
import { useClient } from '../contexts/Client'
import { AnimatePresence, motion } from 'motion/react'
import { Message, Schemas } from '@concrnt/worldlib'
import { TimelinePicker } from './TimelinePicker'
import { Timeline } from '@concrnt/worldlib'
import { useTheme } from '../contexts/Theme'
import { useLocalStorage } from '../hooks/useLocalStorage'
import { CssVar } from '../types/Theme'
import { ComposerMode } from '../contexts/Composer'

interface Props {
    onClose?: () => void
    destinations: string[]
    setDestinations: (destinations: string[]) => void
    options: any[]
    mode: ComposerMode
    targetMessage?: Message<any>
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

    // モードに応じたラベル
    const getCancelLabel = () => {
        switch (props.mode) {
            case 'reply':
                return 'リプライをキャンセル'
            case 'reroute':
                return 'リルートをキャンセル'
            default:
                return 'キャンセル'
        }
    }

    const getSubmitLabel = () => {
        switch (props.mode) {
            case 'reply':
                return 'リプライ'
            case 'reroute':
                return 'リルート'
            default:
                return '投稿'
        }
    }

    const getPlaceholder = () => {
        switch (props.mode) {
            case 'reply':
                return '返信を入力...'
            default:
                return '今、なにしてる？'
        }
    }

    const handleSubmit = async () => {
        if (!client) return

        const homeTimeline = `cckv://${client.ccid}/concrnt.world/main/home-timeline`
        // const activityTimeline = `cckv://${client.ccid}/concrnt.world/main/activity-timeline`
        const distributes = [...(postHome ? [homeTimeline] : []), ...props.destinations]

        try {
            switch (props.mode) {
                case 'reply': {
                    if (!props.targetMessage) {
                        console.error('Reply: targetMessage is undefined')
                        setWillClose(true)
                        return
                    }

                    // リプライメッセージを作成
                    const key = Date.now().toString()
                    const replyMessageUri = `cckv://${client.ccid}/concrnt.world/posts/${key}`
                    const replyDocument = {
                        key: replyMessageUri,
                        schema: Schemas.replyMessage,
                        value: {
                            body: draft,
                            replyToMessageId: props.targetMessage.uri,
                            replyToMessageAuthor: props.targetMessage.author
                        },
                        author: client.ccid,
                        distributes,
                        createdAt: new Date()
                    }

                    console.log('Submitting reply:', replyDocument)
                    await client.api.commit(replyDocument)
                    console.log('Reply submitted, uri:', replyMessageUri)

                    // リプライアソシエーションを作成
                    /*
                    const targetAuthorDomain = await client
                        .getUser(props.targetMessage.author)
                        .then((user) => user?.domain)
                    const notifyTimeline = `cckv://${props.targetMessage.author}/concrnt.world/main/notify-timeline`

                    const associationDocument = {
                        author: client.ccid,
                        schema: Schemas.replyAssociation,
                        associate: props.targetMessage.uri,
                        value: {
                            messageId: replyMessageUri,
                            messageAuthor: client.ccid
                        },
                        distributes: [activityTimeline, notifyTimeline],
                        createdAt: new Date()
                    }

                    console.log('Submitting reply association:', associationDocument)
                    await client.api.commit(associationDocument, targetAuthorDomain)
                    console.log('Reply association submitted')
                    */
                    break
                }
                case 'reroute': {
                    if (!props.targetMessage) {
                        console.error('Reroute: targetMessage is undefined')
                        setWillClose(true)
                        return
                    }

                    // リルートメッセージを作成
                    const key = Date.now().toString()
                    const rerouteMessageUri = `cckv://${client.ccid}/concrnt.world/posts/${key}`
                    const rerouteDocument = {
                        key: rerouteMessageUri,
                        schema: Schemas.rerouteMessage,
                        value: {
                            rerouteMessageId: props.targetMessage.uri,
                            rerouteMessageAuthor: props.targetMessage.author
                        },
                        author: client.ccid,
                        distributes,
                        createdAt: new Date()
                    }

                    console.log('Submitting reroute:', rerouteDocument)
                    await client.api.commit(rerouteDocument)
                    console.log('Reroute submitted, uri:', rerouteMessageUri)

                    // リルートアソシエーションを作成
                    /*
                    const targetAuthorDomain = await client
                        .getUser(props.targetMessage.author)
                        .then((user) => user?.domain)
                    const notifyTimeline = `cckv://${props.targetMessage.author}/concrnt.world/main/notify-timeline`

                    const associationDocument = {
                        author: client.ccid,
                        schema: Schemas.rerouteAssociation,
                        associate: props.targetMessage.uri,
                        value: {
                            messageId: rerouteMessageUri,
                            messageAuthor: client.ccid
                        },
                        distributes: [activityTimeline, notifyTimeline],
                        createdAt: new Date()
                    }

                    console.log('Submitting reroute association:', associationDocument)
                    await client.api.commit(associationDocument, targetAuthorDomain)
                    console.log('Reroute association submitted')
                    */
                    break
                }
                default: {
                    // 通常の投稿
                    const key = Date.now().toString()
                    const document = {
                        key: `cckv://${client.ccid}/concrnt.world/posts/${key}`,
                        schema: Schemas.markdownMessage,
                        value: {
                            body: draft
                        },
                        author: client.ccid,
                        distributes,
                        createdAt: new Date()
                    }
                    await client.api.commit(document)
                }
            }
        } catch (error) {
            console.error('Submit error:', error)
        }

        setWillClose(true)
    }

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

                            {/* リプライ/リルート対象の表示 */}
                            {props.targetMessage && (
                                <div
                                    style={{
                                        padding: '8px',
                                        backgroundColor: CssVar.backdropBackground,
                                        borderRadius: '4px',
                                        borderLeft: '3px solid',
                                        borderLeftColor: CssVar.contentLink,
                                        fontSize: '14px'
                                    }}
                                >
                                    <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>
                                        {props.targetMessage.authorUser?.profile.username}
                                    </div>
                                    <div
                                        style={{
                                            overflow: 'hidden',
                                            textOverflow: 'ellipsis',
                                            whiteSpace: 'nowrap',
                                            opacity: 0.8
                                        }}
                                    >
                                        {props.targetMessage.value.body}
                                    </div>
                                </div>
                            )}

                            {/* リルートモードではテキストエリアを非表示 */}
                            {props.mode !== 'reroute' && (
                                <div
                                    style={{
                                        flex: 1
                                    }}
                                >
                                    <textarea
                                        autoFocus
                                        value={draft}
                                        placeholder={getPlaceholder()}
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
                            )}
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
                                {getCancelLabel()}
                            </Button>
                            <Button onClick={handleSubmit}>{getSubmitLabel()}</Button>
                        </div>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    )
}
