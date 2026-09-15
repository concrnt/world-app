// Chrome内蔵 Translator / LanguageDetector API (Chrome 138+) の最小宣言。
// @types/dom-chromium-ai を入れず、使う範囲だけを書く。
// 両グローバルは非Chromium環境では未定義なので `typeof Translator !== 'undefined'` で必ずガードする
export {}

declare global {
    type TranslationApiAvailability = 'unavailable' | 'downloadable' | 'downloading' | 'available'

    interface TranslationApiCreateMonitor extends EventTarget {
        addEventListener(type: 'downloadprogress', listener: (e: ProgressEvent) => void): void
    }

    interface TranslatorCreateOptions {
        sourceLanguage: string
        targetLanguage: string
        monitor?: (m: TranslationApiCreateMonitor) => void
        signal?: AbortSignal
    }

    interface TranslatorInstance {
        readonly sourceLanguage: string
        readonly targetLanguage: string
        translate(input: string, options?: { signal?: AbortSignal }): Promise<string>
        destroy(): void
    }

    interface LanguageDetectorCreateOptions {
        expectedInputLanguages?: string[]
        monitor?: (m: TranslationApiCreateMonitor) => void
        signal?: AbortSignal
    }

    interface LanguageDetectionResult {
        detectedLanguage: string
        confidence: number
    }

    interface LanguageDetectorInstance {
        detect(input: string, options?: { signal?: AbortSignal }): Promise<LanguageDetectionResult[]>
        destroy(): void
    }

    var Translator:
        | {
              availability(options: {
                  sourceLanguage: string
                  targetLanguage: string
              }): Promise<TranslationApiAvailability>
              create(options: TranslatorCreateOptions): Promise<TranslatorInstance>
          }
        | undefined
    var LanguageDetector:
        | {
              availability(options?: { expectedInputLanguages?: string[] }): Promise<TranslationApiAvailability>
              create(options?: LanguageDetectorCreateOptions): Promise<LanguageDetectorInstance>
          }
        | undefined
}
