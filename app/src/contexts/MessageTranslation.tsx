import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { usePreference } from './Preference'
import { TranslationResult, useTranslationService } from './Translation'

// none: 何も出さない / inline: 本文直前のボタン / menu: 三点メニューの項目 / external: メニューからGoogle翻訳を外部で開く
export type TranslationMode = 'none' | 'inline' | 'menu' | 'external'

export interface MessageTranslationState {
    mode: TranslationMode
    showTranslated: boolean
    translated?: TranslationResult
    working: boolean
    error?: string
    // ボタン/メニュー項目に出す文言
    label: string
    // 未翻訳なら翻訳を実行、翻訳済みなら訳文/原文の表示を切り替える
    toggle: () => void
    externalUrl: string
}

const MessageTranslationContext = createContext<MessageTranslationState | undefined>(undefined)

const errorCodes = ['unsupported', 'undetermined', 'needsTap', 'sameLanguage', 'failed']

const engineLabelKey: Record<TranslationResult['engine'], string> = {
    chrome: 'engineChrome',
    apple: 'engineApple',
    mlkit: 'engineMlkit'
}

const languageName = (code: string, uiLanguage: string): string => {
    try {
        return new Intl.DisplayNames([uiLanguage], { type: 'language', fallback: 'code' }).of(code) ?? code
    } catch {
        return code
    }
}

interface Props {
    // 翻訳元のプレーンテキスト
    text: string
    children: ReactNode
}

// 投稿1件ぶんの翻訳状態。本文ボタン(TranslatableBody)と三点メニュー(MessageActions)が共有する
export const MessageTranslationProvider = (props: Props): ReactNode => {
    const { t, i18n } = useTranslation('', { keyPrefix: 'components.translatableBody' })
    const service = useTranslationService()
    const [enabled] = usePreference('translationEnabled')
    const [autoTranslate] = usePreference('translationAutoTranslate')
    const [style] = usePreference('translationStyle')
    const uiLanguage = i18n.resolvedLanguage ?? 'en'
    const target = uiLanguage.split('-')[0]
    const text = props.text

    const [detected, setDetected] = useState<{ text: string; language?: string }>()
    const [translated, setTranslated] = useState<TranslationResult>()
    const [showTranslated, setShowTranslated] = useState(false)
    const [working, setWorking] = useState(false)
    const [error, setError] = useState<string>()
    // 自動翻訳は1テキストにつき1回だけ試みる(失敗時は静かにボタン表示に戻す)
    const autoAttempted = useRef<string>(undefined)

    const canDetect = enabled && text !== '' && service.available && service.detectorReady
    useEffect(() => {
        if (!canDetect) return
        let cancelled = false
        service.detect(text).then((language) => {
            if (!cancelled) setDetected({ text, language })
        })
        return () => {
            cancelled = true
        }
    }, [canDetect, service, text])

    const mode = useMemo<TranslationMode>(() => {
        if (!enabled || text === '') return 'none'
        if (!service.available) return 'external'
        // webで検知モデル未DLのとき: タップ(activation)内でDL→翻訳できるようメニューにだけ出す
        if (!service.detectorReady) return 'menu'
        if (!detected || detected.text !== text || !detected.language) return 'none'
        const base = detected.language.split('-')[0]
        if (base === target || service.skipLanguages.includes(base)) return 'none'
        return style
    }, [enabled, text, service, detected, target, style])

    const runTranslate = useCallback(
        async (silent: boolean) => {
            setWorking(true)
            setError(undefined)
            try {
                const result = await service.translate(text, target)
                if (result.sourceLanguage.split('-')[0] === target) {
                    if (!silent) setError('sameLanguage')
                    return
                }
                setTranslated(result)
                setShowTranslated(true)
            } catch (e) {
                if (silent) return
                const code = e instanceof Error ? e.message : 'failed'
                setError(errorCodes.includes(code) ? code : 'failed')
            } finally {
                setWorking(false)
            }
        },
        [service, text, target]
    )

    const toggle = useCallback(() => {
        if (working) return
        if (translated) {
            setShowTranslated((v) => !v)
            return
        }
        runTranslate(false)
    }, [working, translated, runTranslate])

    useEffect(() => {
        if (!autoTranslate || translated || working) return
        if (mode !== 'inline' && mode !== 'menu') return
        if (autoAttempted.current === text) return
        autoAttempted.current = text
        runTranslate(true)
    }, [autoTranslate, translated, working, mode, text, runTranslate])

    const label = useMemo(() => {
        if (mode === 'external') return t('openGoogleTranslate')
        if (working) return t('translating')
        if (error) return t(error)
        if (translated && showTranslated) {
            return t('translatedBy', {
                engine: t(engineLabelKey[translated.engine]),
                language: languageName(translated.sourceLanguage, uiLanguage)
            })
        }
        return t('showTranslation')
    }, [mode, working, error, translated, showTranslated, t, uiLanguage])

    const externalUrl = `https://translate.google.com/?sl=auto&tl=${target}&text=${encodeURIComponent(text)}`

    const value = useMemo<MessageTranslationState>(
        () => ({ mode, showTranslated, translated, working, error, label, toggle, externalUrl }),
        [mode, showTranslated, translated, working, error, label, toggle, externalUrl]
    )

    return <MessageTranslationContext.Provider value={value}>{props.children}</MessageTranslationContext.Provider>
}

// Provider外(Oneline等)では undefined
export const useMessageTranslation = (): MessageTranslationState | undefined => useContext(MessageTranslationContext)
