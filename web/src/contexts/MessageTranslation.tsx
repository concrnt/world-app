import { createContext, ReactNode, useCallback, useContext, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toErrorCode, TranslationErrorCode, TranslationResult, useTranslationService } from './Translation'
import { useRenderedBody } from './RenderedBody'

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
    // Google翻訳のURL(本文は呼び出し時点の表示テキスト)
    externalUrl: () => string
}

const MessageTranslationContext = createContext<MessageTranslationState | undefined>(undefined)

interface Props {
    // false なら本文なし扱い(メニュー項目を出さない)
    enabled?: boolean
    children: ReactNode
}

// 投稿1件ぶんの翻訳状態。三点メニュー(MessageActions)で翻訳を実行し、本文下(TranslatableBody)に結果を出す。
// 翻訳元は記法のソースではなく描画結果の innerText(画面に見えている文字列・RenderedBodyProvider 経由)。訳文はマークアップを維持せずプレーンテキストで出す
export const MessageTranslationProvider = (props: Props): ReactNode => {
    const { i18n } = useTranslation()
    const service = useTranslationService()
    const target = (i18n.resolvedLanguage ?? 'en').split('-')[0]
    const body = useRenderedBody()
    const readBody = body?.update

    const [translated, setTranslated] = useState<TranslationResult>()
    const [working, setWorking] = useState(false)
    const [error, setError] = useState<TranslationErrorCode>()

    const mode: TranslationMode = props.enabled === false ? 'none' : service.available ? 'native' : 'external'

    // クリック時点の本文を読み直す(update は最新の innerText を返しつつ AutoSummary 側にも配り直す)
    const sourceText = useCallback(() => (readBody?.() ?? '').trim(), [readBody])

    const translate = useCallback(() => {
        if (working) return
        const text = sourceText()
        if (text === '') return
        setWorking(true)
        setError(undefined)
        service
            .translate(text, target)
            .then(setTranslated)
            .catch((e) => setError(toErrorCode(e)))
            .finally(() => setWorking(false))
    }, [working, service, target, sourceText])

    const undo = useCallback(() => {
        setTranslated(undefined)
        setError(undefined)
    }, [])

    const externalUrl = useCallback(
        () => `https://translate.google.com/?sl=auto&tl=${target}&text=${encodeURIComponent(sourceText())}`,
        [target, sourceText]
    )

    const value = useMemo<MessageTranslationState>(
        () => ({ mode, translated, working, error, translate, undo, externalUrl }),
        [mode, translated, working, error, translate, undo, externalUrl]
    )

    return <MessageTranslationContext.Provider value={value}>{props.children}</MessageTranslationContext.Provider>
}

// Provider外(Oneline等)では undefined
export const useMessageTranslation = (): MessageTranslationState | undefined => useContext(MessageTranslationContext)
