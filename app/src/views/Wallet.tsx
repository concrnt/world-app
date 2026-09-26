import { View } from '@concrnt/ui'
import { useTranslation } from 'react-i18next'
import { Header } from '../ui/Header'

export const WalletView = () => {
    const { t } = useTranslation('', { keyPrefix: 'views.wallet' })

    return (
        <View>
            <Header>{t('title')}</Header>
        </View>
    )
}
