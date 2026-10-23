import { useTranslation } from 'react-i18next'
import { View } from '@concrnt/ui'
import { Header } from '../ui/Header'
import { useStack } from '../layouts/Stack'
import { ExternalAuthConsent } from '../components/ExternalAuthConsent'

interface Props {
    uri: string
}

// concrnt-auth:// の deep link で開かれる同意画面 (CIP-17)。同一端末のリンク (fragment) だけでなく、
// OS のカメラで読んだ QR (direct_post) もここに届く。アプリ内スキャナー (QRSetup) と同じ ExternalAuthConsent を使う
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
