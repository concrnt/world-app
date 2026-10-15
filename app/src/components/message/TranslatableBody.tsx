import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { CssVar, Text } from '@concrnt/ui'
import { useMessageTranslation } from '../../contexts/MessageTranslation'
import type { TranslationResult } from '../../contexts/Translation'

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
    // 原文の描画(翻訳元は RenderedBody が配る innerText)
    children: ReactNode
}

// 原文の下に、翻訳後は「○○による△△語からの翻訳」のキャプション付きで訳文をプレーンテキストで出す。
// 翻訳中・失敗時はキャプションだけ出す。翻訳の実行/取り消しは MessageActions のメニューから
export const TranslatableBody = (props: Props) => {
    const mt = useMessageTranslation()
    const { t, i18n } = useTranslation('', { keyPrefix: 'components.translatedBody' })

    if (!mt) return <>{props.children}</>

    const caption = mt.working
        ? t('translating')
        : mt.error
          ? t(mt.error)
          : mt.translated
            ? t('translatedBy', {
                  engine: t(engineLabelKey[mt.translated.engine]),
                  language: languageName(mt.translated.sourceLanguage, i18n.resolvedLanguage ?? 'en')
              })
            : undefined

    return (
        <>
            {props.children}
            {caption !== undefined && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '4px' }}>
                    <Text variant="caption" style={{ color: CssVar.contentTextDim }}>
                        {caption}
                    </Text>
                    {mt.translated && (
                        <div style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{mt.translated.text}</div>
                    )}
                </div>
            )}
        </>
    )
}
