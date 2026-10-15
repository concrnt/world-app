import { createContext, ReactNode, useCallback, useContext, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toErrorCode, TranslationErrorCode, TranslationResult, useTranslationService } from './Translation'

// none: 本文なし(項目を出さない) / native: 翻訳APIで翻訳 / external: Google翻訳を外部で開く
export type TranslationMode = 'none' | 'native' | 'external'

export interface MessageTranslationState {
    mode: TranslationMode
    translated?: TranslationResult
    working: boolean
    error?: TranslationErrorCode
    // 本文を翻訳して原文の下に訳文を出す
    translate: () => void
    // 訳文(とエラー表示)を消して原文だけに戻す
    undo: () => void
    externalUrl: string
}

const MessageTranslationContext = createContext<MessageTranslationState | undefined>(undefined)

interface Props {
    // 翻訳元の本文(翻訳・Google翻訳URLにはこれをそのまま渡す)
    text: string
    children: ReactNode
}

// 投稿1件ぶんの翻訳状態。三点メニュー(MessageActions)で翻訳を実行し、本文下(TranslatedBody)に結果を出す
export const MessageTranslationProvider = (props: Props): ReactNode => {
    const { i18n } = useTranslation()
    const service = useTranslationService()
    const target = (i18n.resolvedLanguage ?? 'en').split('-')[0]
    const text = props.text

    const [translated, setTranslated] = useState<TranslationResult>()
    const [working, setWorking] = useState(false)
    const [error, setError] = useState<TranslationErrorCode>()

    const mode: TranslationMode = text.trim() === '' ? 'none' : service.available ? 'native' : 'external'

    const translate = useCallback(() => {
        if (working) return
        setWorking(true)
        setError(undefined)
        service
            .translate(text, target)
            .then(setTranslated)
            .catch((e) => setError(toErrorCode(e)))
            .finally(() => setWorking(false))
    }, [working, service, text, target])

    const undo = useCallback(() => {
        setTranslated(undefined)
        setError(undefined)
    }, [])

    const externalUrl = useMemo(
        () => `https://translate.google.com/?sl=auto&tl=${target}&text=${encodeURIComponent(text)}`,
        [target, text]
    )

    const value = useMemo<MessageTranslationState>(
        () => ({ mode, translated, working, error, translate, undo, externalUrl }),
        [mode, translated, working, error, translate, undo, externalUrl]
    )

    return <MessageTranslationContext.Provider value={value}>{props.children}</MessageTranslationContext.Provider>
}

// Provider外(Oneline等)では undefined
export const useMessageTranslation = (): MessageTranslationState | undefined => useContext(MessageTranslationContext)
