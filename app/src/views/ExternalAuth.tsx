import { useTranslation } from 'react-i18next'
import { View } from '@concrnt/ui'
import { Header } from '../ui/Header'
import { useStack } from '../layouts/Stack'
import { ExternalAuthConsent } from '../components/ExternalAuthConsent'

interface Props {
    uri: string
}

// concrnt-auth:// の deep link (CIP-17 同一端末フロー・§8.2) で開かれる同意画面。
// QR 経由 (QRSetup) と同じ ExternalAuthConsent を使う
export const ExternalAuthView = (props: Props) => {
    const { t } = useTranslation('', { keyPrefix: 'app.qrSetup' })
    const stack = useStack()

    return (
        <View>
            <Header>{t('externalAuthTitle')}</Header>
            <div
                style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '1rem',
                    padding: '1rem'
                }}
            >
                <ExternalAuthConsent
                    uri={props.uri}
                    source="deeplink"
                    onComplete={() => {
                        setTimeout(() => {
                            stack.pop()
                        }, 1000)
                    }}
                />
            </div>
        </View>
    )
}
