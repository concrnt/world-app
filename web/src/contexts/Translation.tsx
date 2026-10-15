import { createContext, ReactNode, useCallback, useContext, useMemo } from 'react'

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

// 検知器はモデルDL後は使い回す(create は user activation を要することがあるので1回で済ませる)
let detectorPromise: Promise<LanguageDetectorInstance> | undefined

const getDetector = (): Promise<LanguageDetectorInstance> => {
    if (typeof LanguageDetector === 'undefined') throw new Error('unsupported')
    if (!detectorPromise) {
        detectorPromise = LanguageDetector.create()
        detectorPromise.catch(() => {
            detectorPromise = undefined
        })
    }
    return detectorPromise
}

// DOMException を表示用コードに畳む(既にコード化済みの Error はそのまま)
const asCodedError = (e: unknown): Error => {
    if (e instanceof Error && (errorCodes as string[]).includes(e.message)) return e
    if (e instanceof DOMException) {
        if (e.name === 'NotAllowedError') return new Error('needsTap')
        if (e.name === 'NotSupportedError') return new Error('unsupported')
    }
    return new Error('failed')
}

interface Props {
    children: ReactNode
}

// web版: Chrome内蔵の Translator / LanguageDetector API を使う。
// モデルDLを伴う create は transient user activation が必要なので、translate はタップ直後に呼ばれる想定
export const TranslationProvider = (props: Props): ReactNode => {
    const available = typeof Translator !== 'undefined' && typeof LanguageDetector !== 'undefined'

    const translate = useCallback(async (text: string, targetLanguage: string): Promise<TranslationResult> => {
        if (typeof Translator === 'undefined') throw new Error('unsupported')
        try {
            const detector = await getDetector()
            const top = (await detector.detect(text))[0]
            if (!top || top.detectedLanguage === 'und') throw new Error('undetermined')
            const sourceLanguage = top.detectedLanguage
            if (sourceLanguage.split('-')[0] === targetLanguage) throw new Error('sameLanguage')
            if ((await Translator.availability({ sourceLanguage, targetLanguage })) === 'unavailable')
                throw new Error('unsupported')
            const translator = await Translator.create({ sourceLanguage, targetLanguage })
            try {
                const translated = await translator.translate(text)
                return { text: translated, sourceLanguage, targetLanguage, engine: 'chrome' }
            } finally {
                translator.destroy()
            }
        } catch (e) {
            throw asCodedError(e)
        }
    }, [])

    const value = useMemo<TranslationService>(() => ({ available, translate }), [available, translate])

    return <TranslationContext.Provider value={value}>{props.children}</TranslationContext.Provider>
}

export const useTranslationService = (): TranslationService => useContext(TranslationContext)
