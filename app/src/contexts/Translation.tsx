import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { detectLanguage, isTranslationAvailable, translateText } from '../lib/translation'

export interface TranslationResult {
    text: string
    sourceLanguage: string
    targetLanguage: string
    engine: 'chrome' | 'apple' | 'mlkit'
}

// translate() の失敗は Error.message にこのコードを入れて投げる(表示側で文言に変換する)
export type TranslationErrorCode = 'unsupported' | 'undetermined' | 'needsTap' | 'sameLanguage' | 'failed'
const errorCodes: TranslationErrorCode[] = ['unsupported', 'undetermined', 'needsTap', 'sameLanguage', 'failed']

export const toErrorCode = (e: unknown): TranslationErrorCode =>
    e instanceof Error && (errorCodes as string[]).includes(e.message) ? (e.message as TranslationErrorCode) : 'failed'

export interface TranslationService {
    // 翻訳APIがこの環境で使えるか(false なら投稿メニューはGoogle翻訳リンクに切り替わる)
    available: boolean
    // 本文の言語を検知して targetLanguage(基底コード)へ翻訳する
    translate: (text: string, targetLanguage: string) => Promise<TranslationResult>
}

const fallbackService: TranslationService = {
    available: false,
    translate: async () => {
        throw new Error('unsupported')
    }
}

const TranslationContext = createContext<TranslationService>(fallbackService)

// pluginのrejectはメッセージ文字列で届くので、含まれるコードで分類する(既にコード化済みの Error はそのまま)
const asCodedError = (e: unknown): Error => {
    if (e instanceof Error && (errorCodes as string[]).includes(e.message)) return e
    const s = String(e instanceof Error ? e.message : e)
    if (s.includes('unsupported')) return new Error('unsupported')
    if (s.includes('undetermined')) return new Error('undetermined')
    return new Error('failed')
}

interface Props {
    children: ReactNode
}

// アプリ版: tauri-plugin-translation(iOS: Apple Translation / Android: ML Kit)を使う
export const TranslationProvider = (props: Props): ReactNode => {
    const [available, setAvailable] = useState(false)

    // plugin不在(デスクトップ/旧ビルド)は利用不可扱い
    useEffect(() => {
        isTranslationAvailable()
            .then((res) => setAvailable(res.available))
            .catch(() => setAvailable(false))
    }, [])

    const translate = useCallback(async (text: string, targetLanguage: string): Promise<TranslationResult> => {
        try {
            const detected = await detectLanguage(text)
            if (!detected.language) throw new Error('undetermined')
            if (detected.language.split('-')[0] === targetLanguage) throw new Error('sameLanguage')
            return await translateText(text, targetLanguage, detected.language)
        } catch (e) {
            throw asCodedError(e)
        }
    }, [])

    const value = useMemo<TranslationService>(() => ({ available, translate }), [available, translate])

    return <TranslationContext.Provider value={value}>{props.children}</TranslationContext.Provider>
}

export const useTranslationService = (): TranslationService => useContext(TranslationContext)
