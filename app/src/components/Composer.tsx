import { useEffect, useRef, useState } from 'react'
import { Button, IconButton, Text, CfmRenderer } from '@concrnt/ui'
import { useClient } from '../contexts/Client'
import { isNonNullOrUndefined, Message, Schemas, semantics } from '@concrnt/worldlib'
import { TimelinePicker } from './TimelinePicker'
import { Timeline } from '@concrnt/worldlib'
import { CssVar } from '../types/Theme'
import { ComposerMode, DraftBuffer } from '../contexts/Composer'
import { MdImage, MdClose, MdDeleteOutline, MdUndo } from 'react-icons/md'
import { uploadImage } from '../utils/uploadImage'
import { computeBlurhash } from '../utils/computeBlurhash'
import { hapticSuccess } from '../utils/haptics'
import { MdSend } from 'react-icons/md'
import { MdEmojiEmotions } from 'react-icons/md'
import { useEmojiPicker, Emoji } from '../contexts/EmojiPicker'
import { EmojiSuggestion } from './EmojiSuggestion'
import { MdOutlineUploadFile } from 'react-icons/md'
import { CDID } from '@concrnt/client'

interface MediaDraft {
    file: File
    previewUrl?: string
}

interface Props {
    destinations: string[]
    setDestinations?: (destinations: string[]) => void
    options?: Timeline[]
    mode: ComposerMode
    targetMessage?: Message<any>
    draftBuffer?: DraftBuffer | null
    onSaveDraft?: (buf: DraftBuffer) => void
    onPost?: () => void
    initialProfile?: string
    autoFocus?: boolean
}

export const Composer = (props: Props) => {
    const { client } = useClient()
    const [draft, setDraft] = useState<string>(props.draftBuffer?.draftText ?? '')
    const [postHome, setPostHome] = useState<boolean>(props.draftBuffer?.postHome ?? true)
    const [selectedProfile, setSelectedProfile] = useState<string>(
        props.initialProfile ?? client?.currentProfile ?? 'main'
    )

    // 投稿先リストが切り替わったときにデフォルトプロフィールを追従させる
    useEffect(() => {
        setSelectedProfile(props.initialProfile ?? client?.currentProfile ?? 'main')
    }, [props.initialProfile, client?.currentProfile])
    const [mediaDrafts, setMediaDrafts] = useState<MediaDraft[]>(() => {
        if (!props.draftBuffer || props.draftBuffer.mediaDrafts.length === 0) return []
        return props.draftBuffer.mediaDrafts.map((m) => ({
            file: m.file,
            previewUrl: m.file.type.startsWith('image/') ? URL.createObjectURL(m.file) : undefined
        }))
    })
    const [uploading, setUploading] = useState<boolean>(false)
    const [emojiDict, setEmojiDict] = useState<Record<string, { imageURL: string }>>(props.draftBuffer?.emojiDict ?? {})
    const [undoCache, setUndoCache] = useState<{
        draft: string
        emojiDict: Record<string, { imageURL: string }>
        mediaDrafts: MediaDraft[]
    } | null>(null)

    const fileInputRef = useRef<HTMLInputElement>(null)
    const textareaRef = useRef<HTMLTextAreaElement>(null)
    const emojiPicker = useEmojiPicker()

    // アンマウント時の下書き保存とプレビューURL解放のために最新の状態を参照できるようにする
    const stateRef = useRef({ draft, emojiDict, mediaDrafts, postHome, onSaveDraft: props.onSaveDraft })
    stateRef.current = { draft, emojiDict, mediaDrafts, postHome, onSaveDraft: props.onSaveDraft }

    useEffect(() => {
        return () => {
            const { draft, emojiDict, mediaDrafts, postHome, onSaveDraft } = stateRef.current
            onSaveDraft?.({
                draftText: draft,
                mediaDrafts: mediaDrafts.map((m) => ({ file: m.file })),
                emojiDict,
                postHome
            })
            mediaDrafts
                .map((media) => media.previewUrl)
                .filter(isNonNullOrUndefined)
                .forEach((url) => URL.revokeObjectURL(url))
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
            newMediaDrafts.push({
                file,
                previewUrl: file.type.startsWith('image/') ? URL.createObjectURL(file) : undefined
            })
        }
        setMediaDrafts((prev) => [...prev, ...newMediaDrafts])

        // inputをリセット（同じファイルを再選択可能にする）
        e.target.value = ''
    }

    const removeMedia = (index: number) => {
        setMediaDrafts((prev) => {
            const removed = prev[index]
            if (removed.previewUrl) URL.revokeObjectURL(removed.previewUrl)
            return prev.filter((_, i) => i !== index)
        })
    }

    const reset = () => {
        setDraft('')
        setEmojiDict({})
        mediaDrafts
            .map((media) => media.previewUrl)
            .filter(isNonNullOrUndefined)
            .forEach((url) => URL.revokeObjectURL(url))
        setMediaDrafts([])
    }

    const handleSubmit = async () => {
        if (!client || uploading) return

        const homeTimeline = semantics.homeTimeline(client.ccid, selectedProfile)
        const activityTimeline = semantics.activityTimeline(client.ccid, selectedProfile)
        const distributes = [...(postHome ? [homeTimeline] : []), ...props.destinations]

        const timestamp = new Date()
        const hash = CDID.newFromString(draft, timestamp).toString()

        const newPostUri = semantics.post(client.ccid, selectedProfile, hash)

        let success = false
        try {
            setUploading(true)

            switch (props.mode) {
                case 'reply': {
                    if (!props.targetMessage) {
                        console.error('Reply: targetMessage is undefined')
                        return
                    }

                    // リプライメッセージを作成

                    const replyDocument = {
                        kind: 'record' as const,
                        key: newPostUri,
                        schema: Schemas.replyMessage,
                        value: {
                            body: draft,
                            targetURI: props.targetMessage.uri,
                            emojis: emojiDict
                        },
                        author: client.ccid,
                        distributes,
                        createdAt: timestamp
                    }

                    await client.api.commit(replyDocument)

                    // リプライアソシエーションを作成
                    const targetAuthorDomain = await client
                        .getUser(props.targetMessage.author)
                        .then((user) => user?.domain)
                    const notifyTimeline = semantics.notificationTimeline(props.targetMessage.author, 'main') // TODO: update main to specific

                    const associationDocument = {
                        kind: 'association' as const,
                        author: client.ccid,
                        schema: Schemas.replyAssociation,
                        associate: props.targetMessage.uri,
                        value: {
                            targetURI: newPostUri
                        },
                        distributes: [activityTimeline, notifyTimeline],
                        createdAt: timestamp
                    }

                    await client.api.commit(associationDocument, targetAuthorDomain)
                    break
                }
                case 'reroute': {
                    if (!props.targetMessage) {
                        console.error('Reroute: targetMessage is undefined')
                        return
                    }

                    // リルートメッセージを作成
                    const rerouteDocument = {
                        kind: 'record' as const,
                        key: newPostUri,
                        schema: Schemas.rerouteMessage,
                        value: {
                            targetURI: props.targetMessage.uri
                        },
                        author: client.ccid,
                        distributes,
                        createdAt: timestamp
                    }

                    await client.api.commit(rerouteDocument)

                    // リルートアソシエーションを作成
                    const targetAuthorDomain = await client
                        .getUser(props.targetMessage.author)
                        .then((user) => user?.domain)
                    const notifyTimeline = semantics.notificationTimeline(props.targetMessage.author, 'main') // TODO: update main to specific

                    const associationDocument = {
                        kind: 'association' as const,
                        author: client.ccid,
                        schema: Schemas.rerouteAssociation,
                        associate: props.targetMessage.uri,
                        value: {
                            targetURI: newPostUri
                        },
                        distributes: [activityTimeline, notifyTimeline],
                        createdAt: timestamp
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
                                const [[url, typ], blurhash] = await Promise.all([
                                    uploadImage(client, media.file),
                                    computeBlurhash(media.file)
                                ])
                                return {
                                    mediaURL: url,
                                    mediaType: typ,
                                    ...(blurhash ? { blurhash } : {})
                                }
                            })
                        )

                        const document = {
                            kind: 'record' as const,
                            key: newPostUri,
                            schema: Schemas.mediaMessage,
                            value: {
                                body: draft,
                                medias: uploadedMedias,
                                emojis: emojiDict
                            },
                            author: client.ccid,
                            distributes,
                            createdAt: timestamp
                        }
                        await client.api.commit(document)
                    } else {
                        const document = {
                            kind: 'record' as const,
                            key: newPostUri,
                            schema: Schemas.markdownMessage,
                            value: {
                                body: draft,
                                emojis: emojiDict
                            },
                            author: client.ccid,
                            distributes,
                            createdAt: timestamp
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

        // 失敗時は入力を保持したまま（コンテナも閉じない）
        if (success) {
            hapticSuccess()
            reset()
            props.onPost?.()
        }
    }

    return (
        <div
            style={{
                flex: 1,
                minHeight: 0,
                display: 'flex',
                flexDirection: 'column',
                gap: CssVar.space(2)
            }}
        >
            <TimelinePicker
                items={props.options ?? []}
                selected={props.destinations}
                setSelected={props.setDestinations ?? (() => {})}
                keyFunc={(item: Timeline) => item.uri}
                labelFunc={(item: Timeline) => item.name}
                postHome={postHome}
                setPostHome={setPostHome}
                selectedProfile={selectedProfile}
                setSelectedProfile={setSelectedProfile}
            />

            {/* リプライ/リルート対象の表示 */}
            {props.targetMessage && (
                <div
                    style={{
                        padding: '8px',
                        borderRadius: CssVar.round(1),
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
                <textarea
                    ref={textareaRef}
                    autoFocus={props.autoFocus}
                    value={draft}
                    placeholder={getPlaceholder()}
                    onChange={(e) => setDraft(e.target.value)}
                    style={{
                        width: '100%',
                        flex: 1,
                        minHeight: '80px',
                        fontSize: '1.2rem',
                        boxSizing: 'border-box',
                        border: 'none',
                        outline: 'none',
                        resize: 'none',
                        background: 'transparent',
                        color: CssVar.contentText
                    }}
                    onKeyDown={(e) => {
                        if ((e.key === 'Enter' && e.ctrlKey) || (e.key === 'Enter' && e.metaKey)) {
                            e.preventDefault()
                            handleSubmit()
                        }
                    }}
                />
            )}

            {/* 絵文字サジェスト */}
            {props.mode !== 'reroute' && (
                <EmojiSuggestion
                    textareaRef={textareaRef}
                    text={draft}
                    setText={setDraft}
                    updateEmojiDict={setEmojiDict}
                />
            )}

            {/* テキストプレビュー（絵文字等のレンダリング確認用） */}
            {props.mode !== 'reroute' && draft.length > 0 && (
                <>
                    <div style={{ borderTop: '1px dashed', borderColor: CssVar.divider }} />
                    <div
                        style={{
                            fontSize: '0.85rem',
                            opacity: 0.8,
                            maxHeight: '80px',
                            overflowY: 'auto'
                        }}
                    >
                        <CfmRenderer messagebody={draft} emojiDict={emojiDict} />
                    </div>
                </>
            )}

            {/* 画像プレビュー */}
            {mediaDrafts.length > 0 && (
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    {mediaDrafts.map((media, index) => (
                        <div
                            key={index}
                            style={{
                                position: 'relative',
                                width: '80px',
                                height: '80px'
                            }}
                        >
                            {media.previewUrl ? (
                                <img
                                    src={media.previewUrl}
                                    alt={`preview ${index}`}
                                    style={{
                                        width: '100%',
                                        height: '100%',
                                        objectFit: 'cover',
                                        borderRadius: CssVar.round(2)
                                    }}
                                />
                            ) : (
                                <div
                                    style={{
                                        width: '100%',
                                        height: '100%',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        justifyContent: 'center',
                                        alignItems: 'center',
                                        backgroundColor: CssVar.uiBackground,
                                        borderRadius: CssVar.round(2)
                                    }}
                                >
                                    <MdOutlineUploadFile size={32} color={CssVar.uiText} />
                                    <Text
                                        style={{
                                            marginLeft: '4px',
                                            fontSize: '12px',
                                            color: CssVar.uiText
                                        }}
                                    >
                                        {media.file.name.length > 10
                                            ? media.file.name.slice(0, 7) + '...' + media.file.name.split('.').pop()
                                            : media.file.name}
                                    </Text>
                                </div>
                            )}
                            <IconButton
                                onClick={() => removeMedia(index)}
                                style={{
                                    position: 'absolute',
                                    top: '-8px',
                                    right: '-8px',
                                    backgroundColor: CssVar.divider,
                                    borderRadius: CssVar.round(4),
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

            {/* ツールバー + 送信ボタン */}
            <div
                style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                }}
            >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {/* 画像添付ボタン（リルート以外） */}
                    {props.mode !== 'reroute' && (
                        <IconButton onClick={() => fileInputRef.current?.click()}>
                            <MdImage size={24} />
                        </IconButton>
                    )}
                    {/* 絵文字ピッカーボタン（リルート以外） */}
                    {props.mode !== 'reroute' && (
                        <IconButton
                            onClick={() => {
                                emojiPicker.open((emoji: Emoji) => {
                                    const ta = textareaRef.current
                                    if (ta) {
                                        const start = ta.selectionStart
                                        const end = ta.selectionEnd
                                        const insert = `:${emoji.shortcode}:`
                                        const newDraft = draft.slice(0, start) + insert + draft.slice(end)
                                        setDraft(newDraft)
                                    } else {
                                        setDraft((prev) => prev + `:${emoji.shortcode}:`)
                                    }
                                    setEmojiDict((prev) => ({
                                        ...prev,
                                        [emoji.shortcode]: { imageURL: emoji.imageURL }
                                    }))
                                })
                            }}
                        >
                            <MdEmojiEmotions size={24} />
                        </IconButton>
                    )}
                    {/* ゴミ箱ボタン（リルート以外） */}
                    {props.mode !== 'reroute' && (
                        <IconButton
                            disabled={draft.length === 0 && mediaDrafts.length === 0}
                            onClick={() => {
                                setUndoCache({ draft, emojiDict, mediaDrafts })
                                setDraft('')
                                setEmojiDict({})
                                setMediaDrafts([])
                            }}
                        >
                            <MdDeleteOutline size={24} />
                        </IconButton>
                    )}
                    {/* Undoボタン（キャッシュがあるときのみ） */}
                    {props.mode !== 'reroute' && undoCache && (
                        <IconButton
                            onClick={() => {
                                setDraft(undoCache.draft)
                                setEmojiDict(undoCache.emojiDict)
                                setMediaDrafts(undoCache.mediaDrafts)
                                setUndoCache(null)
                            }}
                        >
                            <MdUndo size={24} />
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

            {/* 隠しファイル入力 */}
            <input ref={fileInputRef} type="file" accept="image/*" multiple hidden onChange={handleFileSelect} />
        </div>
    )
}
