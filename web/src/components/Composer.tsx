import { useEffect, useRef, useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Button, IconButton, List, ListItem, Popover, Text, CfmRenderer, useAnchor } from '@concrnt/ui'
import { useClient } from '../contexts/Client'
import { isNonNullOrUndefined, Message, Schemas, semantics } from '@concrnt/worldlib'
import { TimelinePicker } from './TimelinePicker'
import { Timeline } from '@concrnt/worldlib'
import { CssVar } from '../types/Theme'
import { ComposerMode, DraftBuffer, EditorMode } from '../contexts/Composer'
import { MdImage, MdClose, MdDeleteOutline, MdUndo, MdTextFields, MdPermMedia, MdReply, MdRepeat } from 'react-icons/md'
import { FaMarkdown } from 'react-icons/fa'
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

const modeIcons: Record<EditorMode | 'reply' | 'reroute', ReactNode> = {
    plaintext: <MdTextFields size={24} />,
    markdown: <FaMarkdown size={20} />,
    media: <MdPermMedia size={20} />,
    reply: <MdReply size={24} />,
    reroute: <MdRepeat size={24} />
}

const editorModeLabelKeys: Record<EditorMode, string> = {
    plaintext: 'modePlaintext',
    markdown: 'modeMarkdown',
    media: 'modeMedia'
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
    const { t } = useTranslation('', { keyPrefix: 'components.composer' })
    const { client, isDomainOffline } = useClient()
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
    const [editorMode, setEditorMode] = useState<EditorMode>(
        props.draftBuffer?.editorMode ?? ((props.draftBuffer?.mediaDrafts.length ?? 0) > 0 ? 'media' : 'markdown')
    )
    const [modeSelectOpen, setModeSelectOpen] = useState(false)
    const [emojiDict, setEmojiDict] = useState<Record<string, { imageURL: string }>>(props.draftBuffer?.emojiDict ?? {})
    const [undoCache, setUndoCache] = useState<{
        draft: string
        emojiDict: Record<string, { imageURL: string }>
        mediaDrafts: MediaDraft[]
    } | null>(null)

    const fileInputRef = useRef<HTMLInputElement>(null)
    const textareaRef = useRef<HTMLTextAreaElement>(null)
    const emojiPicker = useEmojiPicker()

    // Composerは複数同時にマウントされ得るため、アンカー名をインスタンスごとに一意にする
    const modeSelectAnchor = useAnchor()

    // リプライ/リルート時はモードを外部から固定し、通常時はユーザーが選択したエディタモードを表示する
    const displayMode: EditorMode | 'reply' | 'reroute' = props.mode === 'normal' ? editorMode : props.mode

    // アンマウント時の下書き保存とプレビューURL解放のために最新の状態を参照できるようにする
    const stateRef = useRef({ draft, emojiDict, mediaDrafts, postHome, editorMode, onSaveDraft: props.onSaveDraft })
    stateRef.current = { draft, emojiDict, mediaDrafts, postHome, editorMode, onSaveDraft: props.onSaveDraft }

    useEffect(() => {
        return () => {
            const { draft, emojiDict, mediaDrafts, postHome, editorMode, onSaveDraft } = stateRef.current
            onSaveDraft?.({
                draftText: draft,
                mediaDrafts: mediaDrafts.map((m) => ({ file: m.file })),
                emojiDict,
                postHome,
                editorMode
            })
            mediaDrafts
                .map((media) => media.previewUrl)
                .filter(isNonNullOrUndefined)
                .forEach((url) => URL.revokeObjectURL(url))
        }
    }, [])

    const getSubmitLabel = () => {
        if (uploading) return t('sending')
        switch (props.mode) {
            case 'reply':
                return t('submitReply')
            case 'reroute':
                return t('submitReroute')
            default:
                return t('submit')
        }
    }

    const getPlaceholder = () => {
        switch (props.mode) {
            case 'reply':
                return t('replyPlaceholder')
            default:
                return t('placeholder')
        }
    }

    const mediaToTag = (url: string, typ: string, name: string): string => {
        if (typ.startsWith('image/')) return `![${name}](${url})`
        if (typ.startsWith('video/')) return `<video controls src="${url}"></video>`
        return `[${name}](${url})`
    }

    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files
        if (!files) return
        const selected = Array.from(files)

        // inputをリセット（同じファイルを再選択可能にする）
        e.target.value = ''

        if (props.mode === 'reply' || editorMode === 'markdown') {
            // リプライ中、またはすでにドラフトがインラインでメディアを扱っている場合は
            // その場でアップロードしてタグを挿入する。そうでなければmediaモードへ切り替える
            const hasInlineMedia = /!\[[^\]]*\]\([^)]*\)/.test(draft) || draft.includes('<video')
            if (props.mode === 'reply' || hasInlineMedia) {
                if (!client || uploading) return
                setUploading(true)
                try {
                    const tags = await Promise.all(
                        selected.map(async (file) => {
                            const [url, typ] = await uploadImage(client, file)
                            return mediaToTag(url, typ, file.name)
                        })
                    )
                    const insert = tags.join('\n')
                    const ta = textareaRef.current
                    if (ta) {
                        const start = ta.selectionStart
                        const end = ta.selectionEnd
                        setDraft((prev) => prev.slice(0, start) + insert + prev.slice(end))
                    } else {
                        setDraft((prev) => prev + insert)
                    }
                } catch (error) {
                    console.error('Upload error:', error)
                } finally {
                    setUploading(false)
                }
                return
            }
            setEditorMode('media')
        }

        const newMediaDrafts: MediaDraft[] = selected.map((file) => ({
            file,
            previewUrl: file.type.startsWith('image/') ? URL.createObjectURL(file) : undefined
        }))
        setMediaDrafts((prev) => [...prev, ...newMediaDrafts])
    }

    const selectEditorMode = async (next: EditorMode) => {
        setModeSelectOpen(false)
        if (next === editorMode) return
        if (editorMode === 'media' && mediaDrafts.length > 0) {
            if (next === 'markdown') {
                // 添付済みメディアをアップロードしてインラインタグへ変換する
                if (!client || uploading) return
                setUploading(true)
                try {
                    const tags = await Promise.all(
                        mediaDrafts.map(async (media) => {
                            const [url, typ] = await uploadImage(client, media.file)
                            return mediaToTag(url, typ, media.file.name)
                        })
                    )
                    setDraft((prev) => (prev === '' ? tags.join('\n') : prev + '\n' + tags.join('\n')))
                } catch (error) {
                    console.error('Media conversion error:', error)
                    return
                } finally {
                    setUploading(false)
                }
            }
            // plaintextへの切り替えではタグ変換できないため破棄する
            mediaDrafts
                .map((media) => media.previewUrl)
                .filter(isNonNullOrUndefined)
                .forEach((url) => URL.revokeObjectURL(url))
            setMediaDrafts([])
        }
        setEditorMode(next)
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
        setEditorMode('markdown')
    }

    const cannotSubmit =
        uploading ||
        isDomainOffline ||
        (displayMode !== 'media' && displayMode !== 'reroute' && draft.trim() === '') ||
        (displayMode === 'media' && mediaDrafts.length === 0)

    const handleSubmit = async () => {
        if (!client || cannotSubmit) return

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
                    // 通常の投稿: エディタモードに応じてスキーマを切り替える
                    switch (editorMode) {
                        case 'plaintext': {
                            const document = {
                                kind: 'record' as const,
                                key: newPostUri,
                                schema: Schemas.plaintextMessage,
                                value: {
                                    body: draft
                                },
                                author: client.ccid,
                                distributes,
                                createdAt: timestamp
                            }
                            await client.api.commit(document)
                            break
                        }
                        case 'media': {
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
                            break
                        }
                        default: {
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
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: CssVar.space(1) }}>
                {/* モードセレクタ。リプライ/リルート時は状態表示のみで切り替え不可 */}
                <IconButton
                    onClick={props.mode === 'normal' ? () => setModeSelectOpen(true) : undefined}
                    style={{ anchorName: modeSelectAnchor } as CSSProperties}
                >
                    {modeIcons[displayMode]}
                </IconButton>
                <div style={{ flex: 1, minWidth: 0 }}>
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
                </div>
            </div>

            <Popover open={modeSelectOpen} onClose={() => setModeSelectOpen(false)} anchor={modeSelectAnchor}>
                <List dense disablePadding style={{ minWidth: '200px' }}>
                    {(Object.keys(editorModeLabelKeys) as EditorMode[]).map((key) => (
                        <ListItem key={key} icon={modeIcons[key]} onClick={() => selectEditorMode(key)}>
                            {t(editorModeLabelKeys[key])}
                        </ListItem>
                    ))}
                </List>
            </Popover>

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
                        fontSize: '1rem',
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

            {/* 絵文字サジェスト（plaintextスキーマは絵文字非対応） */}
            {props.mode !== 'reroute' && displayMode !== 'plaintext' && (
                <EmojiSuggestion
                    textareaRef={textareaRef}
                    text={draft}
                    setText={setDraft}
                    updateEmojiDict={setEmojiDict}
                />
            )}

            {/* テキストプレビュー（絵文字等のレンダリング確認用。plaintextはレンダリングされないため非表示） */}
            {props.mode !== 'reroute' && displayMode !== 'plaintext' && draft.length > 0 && (
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
                    {/* 画像添付ボタン（リルート・プレーンテキスト以外） */}
                    {props.mode !== 'reroute' && displayMode !== 'plaintext' && (
                        <IconButton onClick={() => fileInputRef.current?.click()}>
                            <MdImage size={24} />
                        </IconButton>
                    )}
                    {/* 絵文字ピッカーボタン（リルート・プレーンテキスト以外） */}
                    {props.mode !== 'reroute' && displayMode !== 'plaintext' && (
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
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {isDomainOffline && (
                        <Text variant="caption" style={{ margin: 0 }}>
                            {t('cannotPostOffline')}
                        </Text>
                    )}
                    <Button
                        onClick={handleSubmit}
                        disabled={cannotSubmit}
                        endIcon={<MdSend />}
                        style={{
                            minWidth: '100px'
                        }}
                    >
                        {getSubmitLabel()}
                    </Button>
                </div>
            </div>

            {/* 隠しファイル入力 */}
            <input ref={fileInputRef} type="file" accept="*" multiple hidden onChange={handleFileSelect} />
        </div>
    )
}
