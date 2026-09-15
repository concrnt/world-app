import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { usePreference } from './Preference'
import { TranslationResult, useTranslationService } from './Translation'
import { cfmToPlainText, gfmToPlainText, mfmToPlainText } from '@concrnt/ui'

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

// 本文の記法。言語検知に渡す前に記法由来の要素(URL・メンション・絵文字等)を落とすのに使う
export type MessageSyntax = 'cfm' | 'mfm' | 'gfm' | 'plain'

interface Props {
    // 翻訳元の本文(翻訳・Google翻訳URLにはこれをそのまま渡す)
    text: string
    syntax: MessageSyntax
    children: ReactNode
}

// 言語検知用のクリーンテキスト。記法を剥がしたあと、plain/AP由来のテキストにも残りうる
// 生URL・@user(@host)・#tag・:shortcode:・Unicode絵文字を落として空白を畳む
const toDetectionText = (text: string, syntax: MessageSyntax): string => {
    let plain = text
    if (syntax === 'cfm') plain = cfmToPlainText(text)
    else if (syntax === 'mfm') plain = mfmToPlainText(text)
    else if (syntax === 'gfm') plain = gfmToPlainText(text)
    return plain
        .replace(/https?:\/\/[^\s\u3000]+/g, ' ')
        .replace(/(^|\s)@[\w.@-]+/g, ' ')
        .replace(/(^|\s)#[^\s#]+/g, ' ')
        .replace(/:[\w+-]+:/g, ' ')
        .replace(/\p{Extended_Pictographic}|\p{Emoji_Modifier}|️|‍/gu, ' ')
        .replace(/\s+/g, ' ')
        .trim()
}

// 文字(\p{L})が残らない本文(絵文字だけ・URLだけ・記号だけ)は翻訳対象にしない
const hasLanguageText = (detectionText: string): boolean => /\p{L}/u.test(detectionText)

// 記法パース+言語検知は描画の外(アイドル時)で行う。タイムラインのスクロール中に投稿がまとめてマウントされても
// コミット直後のフレームを塞がないようにする。requestIdleCallback の無い WKWebView ではマクロタスクに落とす
const scheduleIdle = (cb: () => void): (() => void) => {
    if (typeof requestIdleCallback === 'function') {
        const id = requestIdleCallback(cb, { timeout: 2000 })
        return () => cancelIdleCallback(id)
    }
    const id = setTimeout(cb, 0)
    return () => clearTimeout(id)
}

// 検知結果。language が無いのは翻訳API不在/検知モデル未DLの環境で「文章はある」とだけ分かった状態
interface Detected {
    text: string
    language?: string
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
    const syntax = props.syntax
    const { available, detectorReady, detect, skipLanguages } = service

    // 翻訳対象になりうる(= mode が none から変わりうる)ときだけ載せる。
    // UI言語と同じ投稿(大半)は state を触らず、コンテキストの value も変えない
    const [detected, setDetected] = useState<Detected>()
    const [translated, setTranslated] = useState<TranslationResult>()
    const [showTranslated, setShowTranslated] = useState(false)
    const [working, setWorking] = useState(false)
    const [error, setError] = useState<string>()
    // 自動翻訳は1テキストにつき1回だけ試みる(失敗時は静かにボタン表示に戻す)
    const autoAttempted = useRef<string>(undefined)

    useEffect(() => {
        if (!enabled || text === '') return
        let cancelled = false
        const cancelIdle = scheduleIdle(() => {
            const detectionText = toDetectionText(text, syntax)
            if (!hasLanguageText(detectionText)) return
            if (!available || !detectorReady) {
                // 検知できない環境: メニュー項目(external / DL待ちの menu)を出すために文章の有無だけ伝える
                setDetected({ text })
                return
            }
            detect(detectionText).then((language) => {
                if (cancelled || !language) return
                // 翻訳不要な言語(UI言語・翻訳不要リスト)ならここで終わり。state を触らなければ子は再描画されない
                const base = language.split('-')[0]
                if (base === target || skipLanguages.includes(base)) return
                setDetected({ text, language })
            })
        })
        return () => {
            cancelled = true
            cancelIdle()
        }
    }, [enabled, available, detectorReady, detect, skipLanguages, target, text, syntax])

    const mode = useMemo<TranslationMode>(() => {
        if (!enabled || !detected || detected.text !== text) return 'none'
        if (!service.available) return 'external'
        // webで検知モデル未DLのとき: タップ(activation)内でDL→翻訳できるようメニューにだけ出す
        if (!service.detectorReady) return 'menu'
        if (!detected.language) return 'none'
        const base = detected.language.split('-')[0]
        if (base === target || service.skipLanguages.includes(base)) return 'none'
        return style
    }, [enabled, text, service, detected, target, style])

    const runTranslate = useCallback(
        async (silent: boolean) => {
            setWorking(true)
            setError(undefined)
            try {
                // 検知済みならそれを使う。未検知(webで検知モデル未DLのメニュー経路)はタップ内でDL→検知する
                let source = detected?.text === text ? detected.language : undefined
                if (!source) {
                    await service.prepareDetector()
                    source = await service.detect(toDetectionText(text, syntax))
                }
                if (!source) throw new Error('undetermined')
                const result = await service.translate(text, target, source)
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
        [service, text, syntax, target, detected]
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

    const externalUrl = useMemo(
        () => `https://translate.google.com/?sl=auto&tl=${target}&text=${encodeURIComponent(text)}`,
        [target, text]
    )

    const value = useMemo<MessageTranslationState>(
        () => ({ mode, showTranslated, translated, working, error, label, toggle, externalUrl }),
        [mode, showTranslated, translated, working, error, label, toggle, externalUrl]
    )

    return <MessageTranslationContext.Provider value={value}>{props.children}</MessageTranslationContext.Provider>
}

// Provider外(Oneline等)では undefined
export const useMessageTranslation = (): MessageTranslationState | undefined => useContext(MessageTranslationContext)
