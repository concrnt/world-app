import { List, ListItem } from '@concrnt/ui'
import { MdChevronRight, MdLanguage } from 'react-icons/md'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { CssVar } from '../types/Theme'
import { Header } from '../components/Header'
import { View } from '../components/View'

export const GeneralSettingsView = () => {
    const { t } = useTranslation('', { keyPrefix: 'views.generalSettings' })
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
                </List>
            </div>
        </View>
    )
}
