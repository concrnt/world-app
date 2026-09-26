import { useTranslation } from 'react-i18next'
import { View } from '../components/View'
import { Header } from '../components/Header'

export const WalletView = () => {
    const { t } = useTranslation('', { keyPrefix: 'views.wallet' })

    return (
        <View>
            <Header>{t('title')}</Header>
        </View>
    )
}
