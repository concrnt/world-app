import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { usePreference } from './Preference'
import { detectLanguage, isTranslationAvailable, translateText } from '../lib/translation'

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
    // 言語検知が今すぐ使えるか(アプリ版は available と同じ)
    detectorReady: boolean
    // 翻訳不要な言語(基底コード)
    skipLanguages: string[]
    // 生のBCP-47タグ。判定不能・検知不可は undefined
    detect: (text: string) => Promise<string | undefined>
    // sourceLanguage は detect の結果(呼び出し側がクリーンテキストで検知済み)
    translate: (text: string, targetLanguage: string, sourceLanguage: string) => Promise<TranslationResult>
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

// 検知確度がこれ未満なら「判定不能」扱い(短文・記号混じりの誤検出は翻訳不要側に倒す)。web 側の Translation.tsx と同じ値にする
const DETECT_CONFIDENCE_THRESHOLD = 0.7

// 既定の翻訳不要言語 = concrnt の言語設定(UI言語)の基底コード
export const defaultSkipLanguages = (uiLanguage: string): string[] => [uiLanguage.split('-')[0]]

// pluginのrejectはメッセージ文字列で届くので、含まれるコードで分類する
const codeOf = (e: unknown): TranslationErrorCode => {
    const s = String(e instanceof Error ? e.message : e)
    if (s.includes('unsupported')) return 'unsupported'
    if (s.includes('undetermined')) return 'undetermined'
    return 'failed'
}

interface Props {
    children: ReactNode
}

// アプリ版: tauri-plugin-translation(iOS: Apple Translation / Android: ML Kit)を使う
export const TranslationProvider = (props: Props): ReactNode => {
    const { i18n } = useTranslation()
    const [skipPref] = usePreference('translationSkipLanguages')
    const [available, setAvailable] = useState(false)
    const detectCache = useRef<Map<string, Promise<string | undefined>>>(new Map())
    const translateCache = useRef<Map<string, Promise<TranslationResult>>>(new Map())

    const uiLanguage = i18n.resolvedLanguage ?? 'en'
    const skipLanguages = useMemo(() => skipPref ?? defaultSkipLanguages(uiLanguage), [skipPref, uiLanguage])

    // plugin不在(デスクトップ/旧ビルド)は利用不可扱い
    useEffect(() => {
        isTranslationAvailable()
            .then((res) => setAvailable(res.available))
            .catch(() => setAvailable(false))
    }, [])

    const detect = useCallback(async (text: string): Promise<string | undefined> => {
        const cached = detectCache.current.get(text)
        if (cached) return cached
        const promise = detectLanguage(text)
            .then((res) => (res.language && res.confidence >= DETECT_CONFIDENCE_THRESHOLD ? res.language : undefined))
            .catch(() => undefined)
        detectCache.current.set(text, promise)
        return promise
    }, [])

    const translate = useCallback(
        async (text: string, targetLanguage: string, sourceLanguage: string): Promise<TranslationResult> => {
            const key = targetLanguage + '\n' + sourceLanguage + '\n' + text
            const cached = translateCache.current.get(key)
            if (cached) return cached
            const promise = translateText(text, targetLanguage, sourceLanguage).catch((e) =>
                Promise.reject(new Error(codeOf(e)))
            )
            translateCache.current.set(key, promise)
            promise.catch(() => translateCache.current.delete(key))
            return promise
        },
        []
    )

    const prepareDetector = useCallback(async () => {}, [])

    const value = useMemo<TranslationService>(
        () => ({ available, detectorReady: available, skipLanguages, detect, translate, prepareDetector }),
        [available, skipLanguages, detect, translate, prepareDetector]
    )

    return <TranslationContext.Provider value={value}>{props.children}</TranslationContext.Provider>
}

export const useTranslationService = (): TranslationService => useContext(TranslationContext)
