import { Button, Chip, Divider, Switch, Text, ToggleGroup } from '@concrnt/ui'
import { MdAdd, MdClose } from 'react-icons/md'
import { useTranslation } from 'react-i18next'
import { CssVar } from '../types/Theme'
import { Header } from '../components/Header'
import { View } from '../components/View'
import { usePreference } from '../contexts/Preference'
import { useTranslationService } from '../contexts/Translation'

// 翻訳不要言語の追加候補(基底コード)。表示名は Intl.DisplayNames でUI言語に合わせる
const candidateLanguages = [
    'ja',
    'en',
    'zh',
    'ko',
    'fr',
    'de',
    'es',
    'it',
    'pt',
    'ru',
    'ar',
    'hi',
    'th',
    'vi',
    'id',
    'ms',
    'tr',
    'pl',
    'nl',
    'sv',
    'da',
    'fi',
    'no',
    'cs',
    'hu',
    'el',
    'he',
    'uk',
    'ro',
    'bg'
]

const languageName = (code: string, uiLanguage: string): string => {
    try {
        return new Intl.DisplayNames([uiLanguage], { type: 'language', fallback: 'code' }).of(code) ?? code
    } catch {
        return code
    }
}

export const TranslationSettingsView = () => {
    const { t, i18n } = useTranslation('', { keyPrefix: 'views.translationSettings' })
    const service = useTranslationService()
    const [enabled, setEnabled] = usePreference('translationEnabled')
    const [autoTranslate, setAutoTranslate] = usePreference('translationAutoTranslate')
    const [style, setStyle] = usePreference('translationStyle')
    const [, setSkipLanguages] = usePreference('translationSkipLanguages')
    const uiLanguage = i18n.resolvedLanguage ?? 'en'

    // 未設定時の既定(システム言語)は service 側で解決済み。編集した時点で明示配列を保存する
    const skipLanguages = service.skipLanguages
    const candidates = candidateLanguages.filter((c) => !skipLanguages.includes(c))

    return (
        <View>
            <Header>{t('title')}</Header>
            <div
                style={{
                    flex: 1,
                    overflowY: 'auto',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: CssVar.space(4),
                    padding: CssVar.space(4)
                }}
            >
                <Text variant="caption">
                    {!service.available
                        ? t('statusUnavailable')
                        : !service.detectorReady
                          ? t('statusDetectorNotReady')
                          : t('statusAvailable')}
                </Text>
                {service.available && !service.detectorReady && (
                    <Button variant="outlined" onClick={() => service.prepareDetector().catch(() => {})}>
                        {t('downloadDetector')}
                    </Button>
                )}

                <Divider />

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Text variant="h3">{t('enabled')}</Text>
                    <Switch checked={enabled} onChange={setEnabled} />
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Text variant="h3">{t('autoTranslate')}</Text>
                    <Switch checked={autoTranslate} disabled={!enabled} onChange={setAutoTranslate} />
                </div>
                <Text variant="caption">{t('autoTranslateNote')}</Text>

                <Divider />

                <Text variant="h3">{t('style')}</Text>
                <ToggleGroup
                    options={[
                        { value: 'inline', label: t('styleInline') },
                        { value: 'menu', label: t('styleMenu') }
                    ]}
                    value={style}
                    disabled={!enabled}
                    onChange={(v: 'inline' | 'menu') => setStyle(v)}
                />

                <Divider />

                <Text variant="h3">{t('skipLanguages')}</Text>
                <Text variant="caption">{t('skipLanguagesNote')}</Text>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: CssVar.space(2) }}>
                    {skipLanguages.map((code) => (
                        <Chip
                            key={code}
                            tailElement={<MdClose size={14} />}
                            onClick={() => setSkipLanguages(skipLanguages.filter((c) => c !== code))}
                        >
                            {languageName(code, uiLanguage)}
                        </Chip>
                    ))}
                </div>
                <Text variant="caption">{t('addLanguage')}</Text>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: CssVar.space(2) }}>
                    {candidates.map((code) => (
                        <Chip
                            key={code}
                            variant="outlined"
                            tailElement={<MdAdd size={14} />}
                            onClick={() => setSkipLanguages([...skipLanguages, code])}
                        >
                            {languageName(code, uiLanguage)}
                        </Chip>
                    ))}
                </div>
                <div>
                    <Button variant="text" onClick={() => setSkipLanguages(undefined)}>
                        {t('resetDefault')}
                    </Button>
                </div>
            </div>
        </View>
    )
}
