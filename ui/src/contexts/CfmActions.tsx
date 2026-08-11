import { createContext, type ReactNode, useContext } from 'react'
import type { Theme } from '../types/Theme'
import type { EmojipackLite } from '../ui/EmojipackCard'

export interface CfmMediaItem {
    mediaURL: string
    mediaType: string
    altText?: string
}

// Bridge for actions that CfmRenderer (in @concrnt/ui) needs but that live in the
// app layer (theme library, media viewer, user chips, ...). The app wraps its tree
// with CfmActionsProvider; unset actions simply no-op.
export interface CfmActions {
    importTheme?: (theme: Theme) => void
    // Open the app's media viewer. Undefined -> images in messages are not clickable.
    openMedias?: (medias: CfmMediaItem[], index?: number) => void
    // Fetch (with the app's cache) an emoji package by URL, so an <emojipack>
    // reference in a message can render a card. Undefined -> no card is shown.
    loadEmojipack?: (url: string) => Promise<EmojipackLite | null>
    // Subscribe to an emoji package by URL (adds it to the user's library).
    addEmojipack?: (url: string) => void
    // URLs already in the user's library, used to render the "added" state.
    emojipackURLs?: string[]
    // Render an inline chip for a mentioned user (ccid is a con1... CCID).
    // Undefined -> mentions render as plain text.
    renderUserChip?: (ccid: string) => ReactNode
    // Render an inline chip for a timeline reference (fqid is "name@domain").
    // Undefined -> timeline references render as plain text.
    renderTimelineChip?: (fqid: string) => ReactNode
    // Open a URL in the external (OS) browser. Undefined -> ExternalLink falls
    // back to the anchor's default target="_blank" behavior.
    openExternal?: (url: string) => void
}

const CfmActionsContext = createContext<CfmActions>({})

export const CfmActionsProvider = (props: { value: CfmActions; children: ReactNode }) => {
    return <CfmActionsContext.Provider value={props.value}>{props.children}</CfmActionsContext.Provider>
}

export const useCfmActions = (): CfmActions => {
    return useContext(CfmActionsContext)
}
