import { useEffect, useRef, useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import {
    Button,
    ButtonBase,
    CircularProgress,
    IconButton,
    List,
    ListItem,
    Popover,
    Select,
    Text,
    TextField,
    Avatar,
    CfmRenderer,
    useAnchor
} from '@concrnt/ui'
import { useClient } from '../contexts/Client'
import { MessageLayout } from './message/MessageLayout'
import { isNonNullOrUndefined, Message, Schemas, semantics } from '@concrnt/worldlib'
import { TimelinePicker } from './TimelinePicker'
import { Timeline } from '@concrnt/worldlib'
import { CssVar } from '../types/Theme'
import { ComposerMode } from '../contexts/Composer'
import { EditorMode, MediaDraft, useComposerDraft } from '../contexts/ComposerDraft'
import {
    MdImage,
    MdClose,
    MdCheck,
    MdDeleteOutline,
    MdFlag,
    MdUndo,
    MdTextFields,
    MdPermMedia,
    MdReply,
    MdRepeat,
    MdReplay,
    MdCloudUpload
} from 'react-icons/md'
import { FaMarkdown } from 'react-icons/fa'
import { uploadImage } from '../utils/uploadImage'
import { computeBlurhash } from '../utils/computeBlurhash'
import { useHaptics } from '../contexts/Haptics'
import { MdSend } from 'react-icons/md'
import { MdEmojiEmotions } from 'react-icons/md'
import { useEmojiPicker, Emoji } from '../contexts/EmojiPicker'
import { EmojiSuggestion } from './EmojiSuggestion'
import { MdOutlineUploadFile } from 'react-icons/md'
import { CDID } from '@concrnt/client'
import { ComposerMediaEditor } from './ComposerMediaEditor'

const knownFlags = ['warn', 'nude', 'porn', 'hard']

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
    // 「投稿先をデフォルトに戻す」の復帰先。未指定なら現在の投稿先を基準にする(=投稿先の差分は検出されない)
    defaultDestinations?: string[]
    options?: Timeline[]
    mode: ComposerMode
    targetMessage?: Message<any>
    onPost?: () => void
    initialProfile?: string
    autoFocus?: boolean
}

export const Composer = (props: Props) => {
    const { t } = useTranslation('', { keyPrefix: 'components.composer' })
    const { client, isDomainOffline } = useClient()
    const { hapticSuccess } = useHaptics()
    // 通常投稿はアプリ全体で共有される下書き(ComposerDraftProvider)を直接読み書きし、
    // タブ切替・モーダル開閉・画面遷移をまたいで内容を保持する。リプライ/リルートはこのインスタンス限り
    const sharedDraft = useComposerDraft()
    const isShared = props.mode === 'normal'
    const [localDraft, setLocalDraft] = useState<string>('')
    const draft = isShared ? sharedDraft.draftText : localDraft
    const setDraft = isShared ? sharedDraft.setDraftText : setLocalDraft
    const [localPostHome, setLocalPostHome] = useState<boolean>(true)
    const postHome = isShared ? sharedDraft.postHome : localPostHome
    const setPostHome = isShared ? sharedDraft.setPostHome : setLocalPostHome
    const defaultDestinations = props.defaultDestinations ?? props.destinations
    const defaultProfile = props.initialProfile ?? client?.currentProfile ?? 'main'
    const [selectedProfile, setSelectedProfile] = useState<string>(defaultProfile)

    // 投稿先リストが切り替わったときにデフォルトプロフィールを追従させる
    useEffect(() => {
        setSelectedProfile(props.initialProfile ?? client?.currentProfile ?? 'main')
    }, [props.initialProfile, client?.currentProfile])

    // 投稿先・ホームに流すか・投稿元プロフィールのいずれかがデフォルトから外れているか
    const destinationModified =
        props.destinations.length !== defaultDestinations.length ||
        props.destinations.some((dest, i) => dest !== defaultDestinations[i]) ||
        selectedProfile !== defaultProfile ||
        !postHome
    const [localMediaDrafts, setLocalMediaDrafts] = useState<MediaDraft[]>([])
    const mediaDrafts = isShared ? sharedDraft.mediaDrafts : localMediaDrafts
    const setMediaDrafts = isShared ? sharedDraft.setMediaDrafts : setLocalMediaDrafts
    const [uploading, setUploading] = useState<boolean>(false)
    // アップロード中のファイルごとの進捗(0〜1)。キーはアップロード対象配列のindex
    const [uploadProgress, setUploadProgress] = useState<Record<number, number>>({})
    const [dragging, setDragging] = useState<boolean>(false)
    const [localEditorMode, setLocalEditorMode] = useState<EditorMode>('markdown')
    const editorMode = isShared ? sharedDraft.editorMode : localEditorMode
    const setEditorMode = isShared ? sharedDraft.setEditorMode : setLocalEditorMode
    const [modeSelectOpen, setModeSelectOpen] = useState(false)
    const [flagMenuIndex, setFlagMenuIndex] = useState<number | null>(null)
    const [mediaEditorFile, setMediaEditorFile] = useState<File | null>(null)
    const mediaEditorIndex =
        mediaEditorFile === null ? -1 : mediaDrafts.findIndex((media) => media.file === mediaEditorFile)
    const [localEmojiDict, setLocalEmojiDict] = useState<Record<string, { imageURL: string }>>({})
    const emojiDict = isShared ? sharedDraft.emojiDict : localEmojiDict
    const setEmojiDict = isShared ? sharedDraft.setEmojiDict : setLocalEmojiDict
    const [undoCache, setUndoCache] = useState<{
        draft: string
        emojiDict: Record<string, { imageURL: string }>
        mediaDrafts: MediaDraft[]
    } | null>(null)

    useEffect(() => {
        if (mediaEditorFile !== null && mediaEditorIndex === -1) setMediaEditorFile(null)
    }, [mediaEditorFile, mediaEditorIndex])

    const fileInputRef = useRef<HTMLInputElement>(null)
    const textareaRef = useRef<HTMLTextAreaElement>(null)
    const emojiPicker = useEmojiPicker()

    // Composerは複数同時にマウントされ得るため、アンカー名をインスタンスごとに一意にする
    const modeSelectAnchor = useAnchor()

    // リプライ/リルート時はモードを外部から固定し、通常時はユーザーが選択したエディタモードを表示する
    const displayMode: EditorMode | 'reply' | 'reroute' = props.mode === 'normal' ? editorMode : props.mode

    const getSubmitLabel = () => {
        if (uploading) {
            // ファイル転送中は全体進捗のパーセントを添える(転送完了後のcommit待ちは表示しない)
            const progressValues = Object.values(uploadProgress)
            const overall = progressValues.reduce((a, b) => a + b, 0) / progressValues.length
            if (progressValues.length > 0 && overall < 1) {
                return `${t('sending')} ${Math.round(overall * 100)}%`
            }
            return t('sending')
        }
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

        await addFiles(selected)
    }

    // ファイル選択・ペースト・ドロップの3入口から共通で呼ばれる受け入れ口
    const addFiles = async (selected: File[]) => {
        if (props.mode === 'reply' || editorMode === 'markdown') {
            // リプライ中、またはすでにドラフトがインラインでメディアを扱っている場合は
            // その場でアップロードしてタグを挿入する。そうでなければmediaモードへ切り替える
            const hasInlineMedia = /!\[[^\]]*\]\([^)]*\)/.test(draft) || draft.includes('<video')
            if (props.mode === 'reply' || hasInlineMedia) {
                if (!client || uploading) return
                setUploading(true)
                setUploadProgress(Object.fromEntries(selected.map((_, index) => [index, 0])))
                try {
                    const tags = await Promise.all(
                        selected.map(async (file, index) => {
                            const [url, typ] = await uploadImage(client, file, (progress) => {
                                setUploadProgress((prev) => ({ ...prev, [index]: progress }))
                            })
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
                    setUploadProgress({})
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
                setUploadProgress(Object.fromEntries(mediaDrafts.map((_, index) => [index, 0])))
                try {
                    const tags = await Promise.all(
                        mediaDrafts.map(async (media, index) => {
                            const [url, typ] = await uploadImage(client, media.file, (progress) => {
                                setUploadProgress((prev) => ({ ...prev, [index]: progress }))
                            })
                            return mediaToTag(url, typ, media.file.name)
                        })
                    )
                    setDraft((prev) => (prev === '' ? tags.join('\n') : prev + '\n' + tags.join('\n')))
                } catch (error) {
                    console.error('Media conversion error:', error)
                    return
                } finally {
                    setUploading(false)
                    setUploadProgress({})
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
        // アップロード中は進捗表示のindexとズレるため添付の増減を禁止する
        if (uploading) return
        if (mediaDrafts[index]?.file === mediaEditorFile) setMediaEditorFile(null)
        setMediaDrafts((prev) => {
            const removed = prev[index]
            if (removed.previewUrl) URL.revokeObjectURL(removed.previewUrl)
            return prev.filter((_, i) => i !== index)
        })
    }

    const setMediaFlag = (index: number, flag: string | undefined) => {
        setMediaDrafts((prev) => prev.map((m, i) => (i === index ? { ...m, flag } : m)))
    }

    const flagLabels: Record<string, string> = {
        warn: t('flagWarn'),
        nude: t('flagNude'),
        porn: t('flagPorn'),
        hard: t('flagHard')
    }
    const currentFlag = flagMenuIndex !== null ? mediaDrafts[flagMenuIndex]?.flag : undefined

    const reset = () => {
        setDraft('')
        setEmojiDict({})
        mediaDrafts
            .map((media) => media.previewUrl)
            .filter(isNonNullOrUndefined)
            .forEach((url) => URL.revokeObjectURL(url))
        setMediaDrafts([])
        setFlagMenuIndex(null)
        setMediaEditorFile(null)
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
                            replyToMessageAuthor: props.targetMessage.author,
                            emojis: emojiDict
                        },
                        author: client.ccid,
                        distributes,
                        createdAt: timestamp
                    }

                    await client.api.commit(replyDocument)

                    // リプライアソシエーションを作成
                    const targetAuthorDomain = await client
                        .getUser(props.targetMessage.author, props.targetMessage.hint)
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
                            targetURI: props.targetMessage.uri,
                            rerouteMessageAuthor: props.targetMessage.author
                        },
                        author: client.ccid,
                        distributes,
                        createdAt: timestamp
                    }

                    await client.api.commit(rerouteDocument)

                    // リルートアソシエーションを作成
                    const targetAuthorDomain = await client
                        .getUser(props.targetMessage.author, props.targetMessage.hint)
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
                            setUploadProgress(Object.fromEntries(mediaDrafts.map((_, index) => [index, 0])))
                            const uploadedMedias = await Promise.all(
                                mediaDrafts.map(async (media, index) => {
                                    const [[url, typ], blurhash] = await Promise.all([
                                        uploadImage(client, media.file, (progress) => {
                                            setUploadProgress((prev) => ({ ...prev, [index]: progress }))
                                        }),
                                        computeBlurhash(media.file)
                                    ])
                                    return {
                                        mediaURL: url,
                                        mediaType: typ,
                                        ...(blurhash ? { blurhash } : {}),
                                        ...(media.flag ? { flag: media.flag } : {})
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
            setUploadProgress({})
        }

        // 失敗時は入力を保持したまま（コンテナも閉じない）
        if (success) {
            hapticSuccess()
            reset()
            props.onPost?.()
        }
    }

    // ドロップ受け入れは添付ボタンと同じ条件のときだけ有効化する
    const acceptsDrop = props.mode !== 'reroute' && displayMode !== 'plaintext'

    return (
        <div
            style={{
                position: 'relative',
                flex: 1,
                minHeight: 0,
                display: 'flex',
                flexDirection: 'column',
                gap: CssVar.space(2)
            }}
            onDragEnter={(e) => {
                if (!acceptsDrop || !e.dataTransfer.types.includes('Files')) return
                e.preventDefault()
                setDragging(true)
            }}
            onDragOver={(e) => {
                if (!acceptsDrop || !e.dataTransfer.types.includes('Files')) return
                e.preventDefault()
                setDragging(true)
            }}
        >
            {/* D&D中のオーバーレイ。onDragLeaveは子要素通過でのちらつきを避けるためオーバーレイ側に付ける */}
            {dragging && (
                <div
                    style={{
                        position: 'absolute',
                        inset: 0,
                        zIndex: 1,
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'center',
                        alignItems: 'center',
                        gap: CssVar.space(1),
                        border: '2px dashed',
                        borderColor: CssVar.contentLink,
                        borderRadius: CssVar.round(2),
                        backgroundColor: CssVar.contentBackground,
                        opacity: 0.9
                    }}
                    onDragLeave={(e) => {
                        e.preventDefault()
                        setDragging(false)
                    }}
                    onDrop={(e) => {
                        e.preventDefault()
                        setDragging(false)
                        addFiles(Array.from(e.dataTransfer.files))
                    }}
                >
                    <MdCloudUpload size={48} color={CssVar.contentLink} />
                    <Text style={{ margin: 0, color: CssVar.contentLink }}>{t('dropToUpload')}</Text>
                </div>
            )}
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
                {/* v1と同じく、デフォルトから外れているときだけ復帰ボタンを出す */}
                {destinationModified && (
                    <IconButton
                        title={t('resetDestination')}
                        onClick={() => {
                            props.setDestinations?.([...defaultDestinations])
                            setSelectedProfile(defaultProfile)
                            setPostHome(true)
                        }}
                    >
                        <MdReplay size={20} />
                    </IconButton>
                )}
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
                        {props.targetMessage.authorProfile?.username}
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
                        fontFamily: 'inherit',
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
                    onPaste={(e) => {
                        // plaintextは添付非対応なのでテキストペーストだけを通常どおり通す
                        if (displayMode === 'plaintext') return
                        const files = Array.from(e.clipboardData.items)
                            .map((item) => item.getAsFile())
                            .filter(isNonNullOrUndefined)
                        if (files.length === 0) return
                        e.preventDefault()
                        addFiles(files)
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

            {/* 投稿プレビュー（plaintextはレンダリングされないため非表示） */}
            {props.mode !== 'reroute' && displayMode !== 'plaintext' && draft.length > 0 && (
                <>
                    <div style={{ borderTop: '1px dashed', borderColor: CssVar.divider }} />
                    <div style={{ minHeight: 0, overflowY: 'auto' }}>
                        <MessageLayout
                            left={
                                <Avatar
                                    ccid={client.ccid}
                                    src={client.profiles[selectedProfile]?.value.avatar}
                                    style={{ width: '48px', height: '48px' }}
                                />
                            }
                            headerLeft={
                                <span
                                    style={{
                                        fontWeight: 'bold',
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis',
                                        whiteSpace: 'nowrap'
                                    }}
                                >
                                    {client.profiles[selectedProfile]?.value.username || 'Anonymous'}
                                </span>
                            }
                        >
                            <CfmRenderer messagebody={draft} emojiDict={emojiDict} />
                        </MessageLayout>
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
                            <ButtonBase
                                disabled={uploading}
                                aria-label={`${t(media.previewUrl ? 'mediaEditTitle' : 'flagTitle')}: ${media.file.name}`}
                                onClick={() => {
                                    if (media.previewUrl) setMediaEditorFile(media.file)
                                    else setFlagMenuIndex(index)
                                }}
                                style={{
                                    width: '100%',
                                    height: '100%',
                                    padding: 0,
                                    overflow: 'hidden',
                                    borderRadius: CssVar.round(2)
                                }}
                            >
                                {media.previewUrl ? (
                                    <img
                                        src={media.previewUrl}
                                        alt={`preview ${index}`}
                                        style={{
                                            width: '100%',
                                            height: '100%',
                                            objectFit: 'cover'
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
                                            backgroundColor: CssVar.uiBackground
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
                            </ButtonBase>
                            <IconButton
                                onClick={(e) => {
                                    e.stopPropagation()
                                    removeMedia(index)
                                }}
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
                            {media.flag && (
                                <div
                                    title={media.flag}
                                    style={{
                                        position: 'absolute',
                                        bottom: '-8px',
                                        left: '-8px',
                                        backgroundColor: CssVar.divider,
                                        borderRadius: CssVar.round(4),
                                        width: '24px',
                                        height: '24px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        pointerEvents: 'none'
                                    }}
                                >
                                    <MdFlag size={16} />
                                </div>
                            )}
                            {/* アップロード中の進捗表示。転送完了後のcommit待ちはindeterminateで回す */}
                            {uploading && (
                                <div
                                    style={{
                                        position: 'absolute',
                                        inset: 0,
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        backgroundColor: 'rgba(0, 0, 0, 0.4)',
                                        borderRadius: CssVar.round(2),
                                        color: 'white'
                                    }}
                                >
                                    <CircularProgress
                                        value={
                                            (uploadProgress[index] ?? 0) < 1 ? (uploadProgress[index] ?? 0) : undefined
                                        }
                                    />
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}

            <ComposerMediaEditor
                open={mediaEditorIndex !== -1}
                media={mediaEditorIndex !== -1 ? mediaDrafts[mediaEditorIndex] : undefined}
                onClose={() => setMediaEditorFile(null)}
                onFlagChange={(flag) => {
                    if (mediaEditorIndex !== -1) setMediaFlag(mediaEditorIndex, flag)
                }}
            />

            <Select
                open={flagMenuIndex !== null}
                onClose={() => setFlagMenuIndex(null)}
                title={t('flagTitle')}
                options={[
                    <ListItem
                        key="none"
                        endIcon={currentFlag === undefined ? <MdCheck size={20} /> : undefined}
                        onClick={() => {
                            setMediaFlag(flagMenuIndex!, undefined)
                            setFlagMenuIndex(null)
                        }}
                    >
                        {t('flagNone')}
                    </ListItem>,
                    ...knownFlags.map((flag) => (
                        <ListItem
                            key={flag}
                            endIcon={currentFlag === flag ? <MdCheck size={20} /> : undefined}
                            onClick={() => {
                                setMediaFlag(flagMenuIndex!, flag)
                                setFlagMenuIndex(null)
                            }}
                        >
                            {flagLabels[flag]}
                        </ListItem>
                    )),
                    <div key="custom" style={{ padding: `${CssVar.space(1)} ${CssVar.space(2)}` }}>
                        <TextField
                            placeholder={t('flagCustomPlaceholder')}
                            value={currentFlag !== undefined && !knownFlags.includes(currentFlag) ? currentFlag : ''}
                            onChange={(e) =>
                                setMediaFlag(flagMenuIndex!, e.target.value === '' ? undefined : e.target.value)
                            }
                        />
                    </div>
                ]}
            />

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
            <input ref={fileInputRef} type="file" accept="image/*" multiple hidden onChange={handleFileSelect} />
        </div>
    )
}
