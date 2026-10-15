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
    // 訳文の描画(原文と同じレンダラに通す)
    render: (text: string) => ReactNode
}

// 原文の下に「○○による△△語からの翻訳」のキャプション付きで訳文を出す。
// 翻訳中・失敗時はキャプションだけ出す。翻訳の実行/取り消しは MessageActions のメニューから
export const TranslatedBody = (props: Props) => {
    const mt = useMessageTranslation()
    const { t, i18n } = useTranslation('', { keyPrefix: 'components.translatedBody' })

    if (!mt || (!mt.working && !mt.error && !mt.translated)) return null

    const caption = mt.working
        ? t('translating')
        : mt.error
          ? t(mt.error)
          : mt.translated
            ? t('translatedBy', {
                  engine: t(engineLabelKey[mt.translated.engine]),
                  language: languageName(mt.translated.sourceLanguage, i18n.resolvedLanguage ?? 'en')
              })
            : ''

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <Text variant="caption" style={{ color: CssVar.contentTextDim }}>
                {caption}
            </Text>
            {mt.translated && props.render(mt.translated.text)}
        </div>
    )
}
