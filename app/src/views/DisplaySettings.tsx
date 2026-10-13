import { View, List, ListItem, Switch } from '@concrnt/ui'
import { MdChevronRight, MdEmojiEmotions, MdFormatSize, MdLanguage, MdPalette, MdVibration } from 'react-icons/md'
import { useTranslation } from 'react-i18next'
import { CssVar } from '../types/Theme'
import { Header } from '../ui/Header'
import { useStack } from '../layouts/Stack'
import { usePreference } from '../contexts/Preference'
import { LanguageSettingsView } from './LanguageSettings'
import { ThemeSettingsView } from './ThemeSettings'
import { FontSizeSettingsView } from './FontSizeSettings'
import { EmojiSettingsView } from './EmojiSettings'

export const DisplaySettingsView = () => {
    const { t } = useTranslation('', { keyPrefix: 'views.displaySettings' })
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
                        startIcon={<MdPalette size={24} />}
                        endIcon={<MdChevronRight size={24} />}
                        onClick={() => stack.push(<ThemeSettingsView />)}
                    >
                        {t('theme')}
                    </ListItem>
                    <ListItem
                        startIcon={<MdVibration size={24} />}
                        secondaryAction={<Switch checked={hapticsEnabled} onChange={setHapticsEnabled} />}
                    >
                        {t('haptics')}
                    </ListItem>
                    <ListItem
                        startIcon={<MdFormatSize size={24} />}
                        endIcon={<MdChevronRight size={24} />}
                        onClick={() => stack.push(<FontSizeSettingsView />)}
                    >
                        {t('fontSize')}
                    </ListItem>
                    <ListItem
                        startIcon={<MdEmojiEmotions size={24} />}
                        endIcon={<MdChevronRight size={24} />}
                        onClick={() => stack.push(<EmojiSettingsView />)}
                    >
                        {t('emoji')}
                    </ListItem>
                </List>
            </div>
        </View>
    )
}
