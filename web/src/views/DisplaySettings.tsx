import { List, ListItem } from '@concrnt/ui'
import { MdChevronRight, MdEmojiEmotions, MdFormatSize, MdLanguage, MdPalette } from 'react-icons/md'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { CssVar } from '../types/Theme'
import { Header } from '../components/Header'
import { View } from '../components/View'

export const DisplaySettingsView = () => {
    const { t } = useTranslation('', { keyPrefix: 'views.displaySettings' })
    const navigate = useNavigate()

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
                    <ListItem
                        startIcon={<MdLanguage size={24} />}
                        endIcon={<MdChevronRight size={24} />}
                        onClick={() => navigate('/settings/language')}
                    >
                        {t('language')}
                    </ListItem>
                    <ListItem
                        startIcon={<MdPalette size={24} />}
                        endIcon={<MdChevronRight size={24} />}
                        onClick={() => navigate('/settings/theme')}
                    >
                        {t('theme')}
                    </ListItem>
                    <ListItem
                        startIcon={<MdFormatSize size={24} />}
                        endIcon={<MdChevronRight size={24} />}
                        onClick={() => navigate('/settings/fontsize')}
                    >
                        {t('fontSize')}
                    </ListItem>
                    <ListItem
                        startIcon={<MdEmojiEmotions size={24} />}
                        endIcon={<MdChevronRight size={24} />}
                        onClick={() => navigate('/settings/emoji')}
                    >
                        {t('emoji')}
                    </ListItem>
                </List>
            </div>
        </View>
    )
}
