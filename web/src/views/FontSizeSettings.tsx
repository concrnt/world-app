import { List, ListItem } from '@concrnt/ui'
import { MdCheck } from 'react-icons/md'
import { useTranslation } from 'react-i18next'
import { fontSizes, usePreference } from '../contexts/Preference'
import { CssVar } from '../types/Theme'
import { Header } from '../components/Header'
import { View } from '../components/View'

export const FontSizeSettingsView = () => {
    const { t } = useTranslation('', { keyPrefix: 'views.fontSizeSettings' })
    const [fontSize, setFontSize] = usePreference('fontSize')

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
                    {fontSizes.map((size) => (
                        <ListItem
                            key={size}
                            endIcon={fontSize === size ? <MdCheck size={24} /> : undefined}
                            onClick={() => setFontSize(size)}
                        >
                            {t(size)}
                        </ListItem>
                    ))}
                </List>
            </div>
        </View>
    )
}
