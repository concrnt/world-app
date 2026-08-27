import { createContext, useContext, useEffect, useMemo, useState } from 'react'

export type EditorMode = 'plaintext' | 'markdown' | 'media'

export interface MediaDraft {
    file: File
    previewUrl?: string
    flag?: string
}

interface PersistedDraft {
    draftText: string
    emojiDict: Record<string, { imageURL: string }>
    postHome: boolean
    editorMode: EditorMode
}

interface ComposerDraftState {
    draftText: string
    setDraftText: React.Dispatch<React.SetStateAction<string>>
    emojiDict: Record<string, { imageURL: string }>
    setEmojiDict: React.Dispatch<React.SetStateAction<Record<string, { imageURL: string }>>>
    postHome: boolean
    setPostHome: React.Dispatch<React.SetStateAction<boolean>>
    editorMode: EditorMode
    setEditorMode: React.Dispatch<React.SetStateAction<EditorMode>>
    mediaDrafts: MediaDraft[]
    setMediaDrafts: React.Dispatch<React.SetStateAction<MediaDraft[]>>
}

export const composerDraftStorageKey = 'composerDraft'

const defaultPersisted: PersistedDraft = {
    draftText: '',
    emojiDict: {},
    postHome: true,
    editorMode: 'markdown'
}

const loadPersisted = (): PersistedDraft => {
    try {
        const cached = localStorage.getItem(composerDraftStorageKey)
        if (!cached) return defaultPersisted
        const parsed = JSON.parse(cached)
        return {
            draftText: typeof parsed.draftText === 'string' ? parsed.draftText : '',
            emojiDict: typeof parsed.emojiDict === 'object' && parsed.emojiDict !== null ? parsed.emojiDict : {},
            postHome: typeof parsed.postHome === 'boolean' ? parsed.postHome : true,
            // 添付ファイルは永続化されないため、mediaモードのまま復元すると添付0件で投稿不能になる
            editorMode: parsed.editorMode === 'plaintext' ? 'plaintext' : 'markdown'
        }
    } catch (_e) {
        return defaultPersisted
    }
}

const ComposerDraftContext = createContext<ComposerDraftState | null>(null)

interface Props {
    children: React.ReactNode
}

// 通常投稿の下書きをアプリ全体で1つだけ保持する。
// 全Composerインスタンスが同一stateを直接読み書きするため、タブ切替やモーダルの開閉で内容が失われない。
// テキスト系はlocalStorageへ書き込みリロード後も復元されるが、添付ファイル(File)はメモリ保持のみ
export const ComposerDraftProvider = (props: Props) => {
    const [initial] = useState<PersistedDraft>(loadPersisted)
    const [draftText, setDraftText] = useState<string>(initial.draftText)
    const [emojiDict, setEmojiDict] = useState<Record<string, { imageURL: string }>>(initial.emojiDict)
    const [postHome, setPostHome] = useState<boolean>(initial.postHome)
    const [editorMode, setEditorMode] = useState<EditorMode>(initial.editorMode)
    const [mediaDrafts, setMediaDrafts] = useState<MediaDraft[]>([])

    useEffect(() => {
        try {
            const persisted: PersistedDraft = {
                draftText,
                emojiDict,
                postHome,
                editorMode: editorMode === 'media' ? 'markdown' : editorMode
            }
            localStorage.setItem(composerDraftStorageKey, JSON.stringify(persisted))
        } catch (_e) {
            // 容量超過などで保存できなくても入力自体は継続できる
        }
    }, [draftText, emojiDict, postHome, editorMode])

    const value = useMemo(
        () => ({
            draftText,
            setDraftText,
            emojiDict,
            setEmojiDict,
            postHome,
            setPostHome,
            editorMode,
            setEditorMode,
            mediaDrafts,
            setMediaDrafts
        }),
        [draftText, emojiDict, postHome, editorMode, mediaDrafts]
    )

    return <ComposerDraftContext.Provider value={value}>{props.children}</ComposerDraftContext.Provider>
}

export const useComposerDraft = (): ComposerDraftState => {
    const context = useContext(ComposerDraftContext)
    if (!context) throw new Error('useComposerDraft must be used within ComposerDraftProvider')
    return context
}
