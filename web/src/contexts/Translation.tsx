import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { usePreference } from './Preference'

export interface TranslationResult {
    text: string
    sourceLanguage: string
    targetLanguage: string
    engine: 'chrome' | 'apple' | 'mlkit'
}

// translate() の失敗は Error.message にこのコードを入れて投げる
export type TranslationErrorCode = 'unsupported' | 'undetermined' | 'needsTap' | 'sameLanguage' | 'failed'

export interface TranslationService {
    // 翻訳APIがこの環境で使えるか
    available: boolean
    // 言語検知が今すぐ使えるか(webは検知モデルのDL済みかどうか。未DLならユーザー操作内の prepareDetector で用意する)
    detectorReady: boolean
    // 翻訳不要な言語(基底コード)
    skipLanguages: string[]
    // 生のBCP-47タグ。判定不能・検知不可は undefined
    detect: (text: string) => Promise<string | undefined>
    translate: (text: string, targetLanguage: string) => Promise<TranslationResult>
    prepareDetector: () => Promise<void>
}

const fallbackService: TranslationService = {
    available: false,
    detectorReady: false,
    skipLanguages: [],
    detect: async () => undefined,
    translate: async () => {
        throw new Error('failed')
    },
    prepareDetector: async () => {}
}

const TranslationContext = createContext<TranslationService>(fallbackService)

// 既定の翻訳不要言語 = concrnt の言語設定(UI言語)の基底コード
export const defaultSkipLanguages = (uiLanguage: string): string[] => [uiLanguage.split('-')[0]]

// モデルDL後は同一の検知器を使い回す(create は user activation を要することがあるので1回で済ませる)
let detectorPromise: Promise<LanguageDetectorInstance> | undefined

const codeOf = (e: unknown): TranslationErrorCode => {
    if (e instanceof DOMException) {
        if (e.name === 'NotAllowedError') return 'needsTap'
        if (e.name === 'NotSupportedError') return 'unsupported'
    }
    return 'failed'
}

interface Props {
    children: ReactNode
}

// web版: Chrome内蔵の Translator / LanguageDetector API を使う
export const TranslationProvider = (props: Props): ReactNode => {
    const { i18n } = useTranslation()
    const [skipPref] = usePreference('translationSkipLanguages')
    const available = typeof Translator !== 'undefined' && typeof LanguageDetector !== 'undefined'
    const [detectorReady, setDetectorReady] = useState(detectorPromise !== undefined)
    const detectCache = useRef<Map<string, Promise<string | undefined>>>(new Map())
    const translateCache = useRef<Map<string, Promise<TranslationResult>>>(new Map())

    const uiLanguage = i18n.resolvedLanguage ?? 'en'
    const skipLanguages = useMemo(() => skipPref ?? defaultSkipLanguages(uiLanguage), [skipPref, uiLanguage])

    const prepareDetector = useCallback(async () => {
        if (typeof LanguageDetector === 'undefined') throw new Error('failed')
        if (!detectorPromise) {
            detectorPromise = LanguageDetector.create()
            detectorPromise.catch(() => {
                detectorPromise = undefined
            })
        }
        await detectorPromise
        setDetectorReady(true)
    }, [])

    // 検知モデルがDL済みなら user activation なしで create できる。未DLなら prepareDetector(タップ内)待ち
    useEffect(() => {
        if (typeof LanguageDetector === 'undefined') return
        LanguageDetector.availability()
            .then((a) => {
                if (a === 'available') return prepareDetector()
            })
            .catch(() => {})
    }, [prepareDetector])

    const detect = useCallback(async (text: string): Promise<string | undefined> => {
        if (!detectorPromise) return undefined
        const cached = detectCache.current.get(text)
        if (cached) return cached
        const promise = detectorPromise
            .then((d) => d.detect(text))
            .then((results) => {
                const top = results[0]
                if (!top || top.detectedLanguage === 'und' || top.confidence < 0.5) return undefined
                return top.detectedLanguage
            })
            .catch(() => undefined)
        detectCache.current.set(text, promise)
        return promise
    }, [])

    const translate = useCallback(
        async (text: string, targetLanguage: string): Promise<TranslationResult> => {
            const key = targetLanguage + '\n' + text
            const cached = translateCache.current.get(key)
            if (cached) return cached
            const promise = (async () => {
                if (typeof Translator === 'undefined') throw new Error('failed')
                // ここはタップ直後に呼ばれる想定(モデルDLを伴う create は transient activation が必要)
                if (!detectorPromise) await prepareDetector().catch((e) => Promise.reject(new Error(codeOf(e))))
                const sourceLanguage = await detect(text)
                if (!sourceLanguage) throw new Error('undetermined')
                if (sourceLanguage.split('-')[0] === targetLanguage.split('-')[0]) throw new Error('sameLanguage')
                const availability = await Translator.availability({ sourceLanguage, targetLanguage })
                if (availability === 'unavailable') throw new Error('unsupported')
                let translator: TranslatorInstance
                try {
                    translator = await Translator.create({ sourceLanguage, targetLanguage })
                } catch (e) {
                    throw new Error(codeOf(e))
                }
                try {
                    const translated = await translator.translate(text)
                    return { text: translated, sourceLanguage, targetLanguage, engine: 'chrome' as const }
                } catch (e) {
                    throw new Error(codeOf(e))
                } finally {
                    translator.destroy()
                }
            })()
            translateCache.current.set(key, promise)
            promise.catch(() => translateCache.current.delete(key))
            return promise
        },
        [detect, prepareDetector]
    )

    const value = useMemo<TranslationService>(
        () => ({ available, detectorReady, skipLanguages, detect, translate, prepareDetector }),
        [available, detectorReady, skipLanguages, detect, translate, prepareDetector]
    )

    return <TranslationContext.Provider value={value}>{props.children}</TranslationContext.Provider>
}

export const useTranslationService = (): TranslationService => useContext(TranslationContext)
