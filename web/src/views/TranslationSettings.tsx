import { Button, Divider, Switch, Text, ToggleGroup } from '@concrnt/ui'
import { useTranslation } from 'react-i18next'
import { CssVar } from '../types/Theme'
import { Header } from '../components/Header'
import { View } from '../components/View'
import { LanguagePicker } from '../components/LanguagePicker'
import { usePreference } from '../contexts/Preference'
import { useTranslationService } from '../contexts/Translation'

export const TranslationSettingsView = () => {
    const { t } = useTranslation('', { keyPrefix: 'views.translationSettings' })
    const service = useTranslationService()
    const [enabled, setEnabled] = usePreference('translationEnabled')
    const [autoTranslate, setAutoTranslate] = usePreference('translationAutoTranslate')
    const [style, setStyle] = usePreference('translationStyle')
    const [, setSkipLanguages] = usePreference('translationSkipLanguages')

    // 未設定時の既定(システム言語)は service 側で解決済み。編集した時点で明示配列を保存する
    const skipLanguages = service.skipLanguages

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
                <LanguagePicker selected={skipLanguages} setSelected={setSkipLanguages} />
                <div>
                    <Button variant="text" onClick={() => setSkipLanguages(undefined)}>
                        {t('resetDefault')}
                    </Button>
                </div>
            </div>
        </View>
    )
}
