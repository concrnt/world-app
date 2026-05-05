import { useEffect, useRef, useState } from 'react'
import { Button, Divider, IconButton, useTheme } from '@concrnt/ui'
import { useClient } from '../contexts/Client'
import { AnimatePresence, motion } from 'motion/react'
import { Message, Schemas, semantics } from '@concrnt/worldlib'
import { TimelinePicker } from './TimelinePicker'
import { Timeline } from '@concrnt/worldlib'
import { useLocalStorage } from '../hooks/useLocalStorage'
import { CssVar } from '../types/Theme'
import { ComposerMode } from '../contexts/Composer'
import { MdImage, MdClose } from 'react-icons/md'
import { uploadImage } from '../utils/uploadImage'
import { hapticSuccess } from '../utils/haptics'
import { MdSend } from 'react-icons/md'

interface MediaDraft {
    file: File
    previewUrl: string
}

interface Props {
    onClose?: () => void
    destinations: string[]
    setDestinations: (destinations: string[]) => void
    options: Timeline[]
    mode: ComposerMode
    targetMessage?: Message<any>
}

export const Composer = (props: Props) => {
    const { client } = useClient()
    const [willClose, setWillClose] = useState<boolean>(false)
    const [draft, setDraft] = useState<string>('')
    const [postHome, setPostHome] = useState<boolean>(true)
    const [mediaDrafts, setMediaDrafts] = useState<MediaDraft[]>([])
    const [uploading, setUploading] = useState<boolean>(false)

    const fileInputRef = useRef<HTMLInputElement>(null)
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

    // クリーンアップ: プレビューURLを解放
    useEffect(() => {
        return () => {
            mediaDrafts.forEach((media) => URL.revokeObjectURL(media.previewUrl))
        }
    }, [])

    const getSubmitLabel = () => {
        if (uploading) return '送信中...'
        switch (props.mode) {
            case 'reply':
                return 'リプライ'
            case 'reroute':
                return 'リルート'
            default:
                return 'カレント'
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

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files
        if (!files) return

        const newMediaDrafts: MediaDraft[] = []
        for (let i = 0; i < files.length; i++) {
            const file = files[i]
            if (file.type.startsWith('image/')) {
                newMediaDrafts.push({
                    file,
                    previewUrl: URL.createObjectURL(file)
                })
            }
        }
        setMediaDrafts((prev) => [...prev, ...newMediaDrafts])

        // inputをリセット（同じファイルを再選択可能にする）
        e.target.value = ''
    }

    const removeMedia = (index: number) => {
        setMediaDrafts((prev) => {
            const removed = prev[index]
            URL.revokeObjectURL(removed.previewUrl)
            return prev.filter((_, i) => i !== index)
        })
    }

    const handleSubmit = async () => {
        if (!client) return

        const homeTimeline = semantics.homeTimeline(client.ccid, client.currentProfile)
        const activityTimeline = semantics.activityTimeline(client.ccid, client.currentProfile)
        const distributes = [...(postHome ? [homeTimeline] : []), ...props.destinations]
        const key = Date.now().toString()
        const newPostUri = semantics.post(client.ccid, client.currentProfile, key)

        let success = false
        try {
            setUploading(true)

            switch (props.mode) {
                case 'reply': {
                    if (!props.targetMessage) {
                        console.error('Reply: targetMessage is undefined')
                        setWillClose(true)
                        return
                    }

                    // リプライメッセージを作成

                    const replyDocument = {
                        key: newPostUri,
                        schema: Schemas.replyMessage,
                        value: {
                            body: draft,
                            replyToMessageId: props.targetMessage.uri
                        },
                        author: client.ccid,
                        distributes,
                        createdAt: new Date()
                    }

                    await client.api.commit(replyDocument)

                    // リプライアソシエーションを作成
                    const targetAuthorDomain = await client
                        .getUser(props.targetMessage.author)
                        .then((user) => user?.domain)
                    const notifyTimeline = semantics.notificationTimeline(props.targetMessage.author, 'main') // TODO: update main to specific

                    const associationDocument = {
                        author: client.ccid,
                        schema: Schemas.replyAssociation,
                        associate: props.targetMessage.uri,
                        value: {
                            messageId: newPostUri
                        },
                        distributes: [activityTimeline, notifyTimeline],
                        createdAt: new Date()
                    }

                    await client.api.commit(associationDocument, targetAuthorDomain)
                    break
                }
                case 'reroute': {
                    if (!props.targetMessage) {
                        console.error('Reroute: targetMessage is undefined')
                        setWillClose(true)
                        return
                    }

                    // リルートメッセージを作成
                    const rerouteDocument = {
                        key: newPostUri,
                        schema: Schemas.rerouteMessage,
                        value: {
                            rerouteMessageId: props.targetMessage.uri
                        },
                        author: client.ccid,
                        distributes,
                        createdAt: new Date()
                    }

                    await client.api.commit(rerouteDocument)

                    // リルートアソシエーションを作成
                    const targetAuthorDomain = await client
                        .getUser(props.targetMessage.author)
                        .then((user) => user?.domain)
                    const notifyTimeline = semantics.notificationTimeline(props.targetMessage.author, 'main') // TODO: update main to specific

                    const associationDocument = {
                        author: client.ccid,
                        schema: Schemas.rerouteAssociation,
                        associate: props.targetMessage.uri,
                        value: {
                            messageId: newPostUri
                        },
                        distributes: [activityTimeline, notifyTimeline],
                        createdAt: new Date()
                    }

                    await client.api.commit(associationDocument, targetAuthorDomain)
                    break
                }
                default: {
                    // 通常の投稿

                    // 画像がある場合は mediaMessage、なければ markdownMessage
                    if (mediaDrafts.length > 0) {
                        // 画像をアップロード
                        const uploadedMedias = await Promise.all(
                            mediaDrafts.map(async (media) => {
                                const url = await uploadImage(client, media.file)
                                return {
                                    mediaURL: url,
                                    mediaType: media.file.type
                                }
                            })
                        )

                        const document = {
                            key: newPostUri,
                            schema: Schemas.mediaMessage,
                            value: {
                                body: draft,
                                medias: uploadedMedias
                            },
                            author: client.ccid,
                            distributes,
                            createdAt: new Date()
                        }
                        await client.api.commit(document)
                    } else {
                        const document = {
                            key: newPostUri,
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
            }
            success = true
        } catch (error) {
            console.error('Submit error:', error)
        } finally {
            setUploading(false)
        }

        if (success) hapticSuccess()
        setWillClose(true)
    }

    return (
        <AnimatePresence
            onExitComplete={() => {
                setDraft('')
                mediaDrafts.forEach((media) => URL.revokeObjectURL(media.previewUrl))
                setMediaDrafts([])
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
                                    theme.variant === 'classic' ? undefined : `${CssVar.space(2)} ${CssVar.space(2)} 0`,
                                overflow: 'auto'
                            }}
                        >
                            <div style={{ display: 'flex', alignItems: 'center' }}>
                                <Button
                                    variant="text"
                                    onClick={() => {
                                        setWillClose(true)
                                    }}
                                    style={{
                                        fontSize: '0.9rem',
                                        padding: 0
                                    }}
                                >
                                    キャンセル
                                </Button>
                            </div>

                            <Divider />

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
                                            fontSize: '1.2rem',
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

                            {/* 画像プレビュー */}
                            {mediaDrafts.length > 0 && (
                                <div
                                    style={{
                                        display: 'flex',
                                        gap: '8px',
                                        flexWrap: 'wrap'
                                    }}
                                >
                                    {mediaDrafts.map((media, index) => (
                                        <div
                                            key={index}
                                            style={{
                                                position: 'relative',
                                                width: '80px',
                                                height: '80px'
                                            }}
                                        >
                                            <img
                                                src={media.previewUrl}
                                                alt={`preview ${index}`}
                                                style={{
                                                    width: '100%',
                                                    height: '100%',
                                                    objectFit: 'cover',
                                                    borderRadius: '8px'
                                                }}
                                            />
                                            <IconButton
                                                onClick={() => removeMedia(index)}
                                                style={{
                                                    position: 'absolute',
                                                    top: '-8px',
                                                    right: '-8px',
                                                    backgroundColor: CssVar.contentBackground,
                                                    borderRadius: '50%',
                                                    padding: '2px',
                                                    width: '24px',
                                                    height: '24px'
                                                }}
                                            >
                                                <MdClose size={16} />
                                            </IconButton>
                                        </div>
                                    ))}
                                </div>
                            )}
                            <div
                                style={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center'
                                }}
                            >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    {/* 画像添付ボタン（通常投稿モードのみ） */}
                                    {props.mode === 'normal' && (
                                        <IconButton onClick={() => fileInputRef.current?.click()}>
                                            <MdImage size={24} />
                                        </IconButton>
                                    )}
                                </div>
                                <Button
                                    onClick={handleSubmit}
                                    disabled={uploading}
                                    endIcon={<MdSend />}
                                    style={{
                                        minWidth: '100px'
                                    }}
                                >
                                    {getSubmitLabel()}
                                </Button>
                            </div>
                        </div>
                    </div>

                    {/* 隠しファイル入力 */}
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        multiple
                        hidden
                        onChange={handleFileSelect}
                    />
                </motion.div>
            )}
        </AnimatePresence>
    )
}
