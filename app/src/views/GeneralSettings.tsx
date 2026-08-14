import { View, List, ListItem, Switch } from '@concrnt/ui'
import { MdChevronRight, MdLanguage, MdVibration } from 'react-icons/md'
import { useTranslation } from 'react-i18next'
import { CssVar } from '../types/Theme'
import { Header } from '../ui/Header'
import { useStack } from '../layouts/Stack'
import { usePreference } from '../contexts/Preference'
import { LanguageSettingsView } from './LanguageSettings'

export const GeneralSettingsView = () => {
    const { t } = useTranslation('', { keyPrefix: 'views.generalSettings' })
    const stack = useStack()
    const [hapticsEnabled, setHapticsEnabled] = usePreference('hapticsEnabled')

    return (
        <View>
            <Header>{t('title')}</Header>
            <div
                style={{
                    flex: 1,
                    overflowY: 'auto',
                    touchAction: 'pan-y',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: CssVar.space(3),
                    padding: CssVar.space(4)
                }}
            >
                <List>
                    <ListItem
                        startIcon={<MdLanguage size={24} />}
                        endIcon={<MdChevronRight size={24} />}
                        onClick={() => stack.push(<LanguageSettingsView />)}
                    >
                        {t('language')}
                    </ListItem>
                    <ListItem
                        startIcon={<MdVibration size={24} />}
                        secondaryAction={<Switch checked={hapticsEnabled} onChange={setHapticsEnabled} />}
                    >
                        {t('haptics')}
                    </ListItem>
                </List>
            </div>
        </View>
    )
}
