import { invoke } from '@tauri-apps/api/core'
import type { TranslationResult } from '../contexts/Translation'

// tauri-plugin-translation (iOS: Apple Translation framework / Android: ML Kit) の薄いラッパ。
// WebViewには翻訳APIが無いのでアプリ版はpluginで実装している
export const isTranslationAvailable = (): Promise<{ available: boolean }> =>
    invoke<{ available: boolean }>('plugin:translation|is_available')

// confidence は 0..1(判定不能時は language=null, confidence=0)
export const detectLanguage = (text: string): Promise<{ language: string | null; confidence: number }> =>
    invoke<{ language: string | null; confidence: number }>('plugin:translation|detect_language', { payload: { text } })

export const translateText = (
    text: string,
    targetLanguage: string,
    sourceLanguage: string
): Promise<TranslationResult> =>
    invoke<TranslationResult>('plugin:translation|translate', { payload: { text, targetLanguage, sourceLanguage } })
