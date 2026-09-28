import { Text } from '@concrnt/ui'
import { useTranslation } from 'react-i18next'
import { useClient } from '../contexts/Client'

// ホームサーバーがオフラインのとき(読み取り専用モード)に表示する帯。
// 復旧はClientProviderが検知して裏で再検証するので、バナーは無音で消える
export const DomainOfflineBanner = () => {
    const { t } = useTranslation('', { keyPrefix: 'components.domainOfflineBanner' })
    const { client, isDomainOffline } = useClient()

    if (!isDomainOffline) return null

    return (
        <div
            style={{
                width: '100%',
                boxSizing: 'border-box',
                backgroundColor: '#d32f2f',
                color: '#ffffff',
                padding: '6px 8px',
                textAlign: 'center',
                flexShrink: 0,
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                gap: '8px'
            }}
        >
            <Text variant="caption" style={{ color: '#ffffff', margin: 0 }}>
                {t('offline', { domain: client.api.defaultHost })}
            </Text>
        </div>
    )
}
