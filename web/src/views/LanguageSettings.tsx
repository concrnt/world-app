import { List, ListItem } from '@concrnt/ui'
import { MdCheck } from 'react-icons/md'
import { useTranslation } from 'react-i18next'
import { languages } from '@concrnt/locales'
import { CssVar } from '../types/Theme'
import { Header } from '../components/Header'
import { View } from '../components/View'

export const LanguageSettingsView = () => {
    const { t, i18n } = useTranslation('', { keyPrefix: 'views.languageSettings' })

    return (
        <View>
            <Header>{t('title')}</Header>
            <div
                style={{
                    flex: 1,
                    overflowY: 'auto',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: CssVar.space(3),
                    padding: CssVar.space(4)
                }}
            >
                <List>
                    {languages.map((language) => (
                        <ListItem
                            key={language.code}
                            endIcon={i18n.resolvedLanguage === language.code ? <MdCheck size={24} /> : undefined}
                            onClick={() => i18n.changeLanguage(language.code)}
                        >
                            {language.label}
                        </ListItem>
                    ))}
                </List>
            </div>
        </View>
    )
}
