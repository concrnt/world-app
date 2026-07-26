import { Button, Text } from '@concrnt/ui'
import { useTranslation } from 'react-i18next'
import { useClient, useClientSetupProgress } from '../contexts/Client'

// サブプロフィール切替の進行中/失敗を通知する帯。切替は旧UIを表示したまま
// バックグラウンドで行われるため、全画面ロードの代わりにこの帯で状態を示す
export const AccountSwitchingBanner = () => {
    const { t } = useTranslation('', { keyPrefix: 'components.accountSwitchingBanner' })
    const { isSwitching, switchError, dismissSwitchError } = useClient()
    const progress = useClientSetupProgress()

    if (!isSwitching && !switchError) return null

    return (
        <div
            style={{
                width: '100%',
                boxSizing: 'border-box',
                backgroundColor: switchError ? '#d32f2f' : '#1565c0',
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
            {switchError ? (
                <>
                    <Text variant="caption" style={{ color: '#ffffff', margin: 0 }}>
                        {t('failed', { error: switchError })}
                    </Text>
                    <Button
                        variant="text"
                        style={{ color: '#ffffff', minHeight: 0, padding: '2px 8px' }}
                        onClick={() => {
                            dismissSwitchError()
                        }}
                    >
                        {t('dismiss')}
                    </Button>
                </>
            ) : (
                <Text variant="caption" style={{ color: '#ffffff', margin: 0 }}>
                    {progress || t('switching')}
                </Text>
            )}
        </div>
    )
}
