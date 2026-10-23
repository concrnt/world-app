import { useTranslation } from 'react-i18next'
import { View, Text } from '@concrnt/ui'
import { Header } from '../ui/Header'
import { useStack } from '../layouts/Stack'
import { ExternalAuthConsent } from '../components/ExternalAuthConsent'
import { SignalLoginConsent } from '../components/SignalLoginConsent'
import { parseSignalLoginUri } from '../lib/signalLogin'

interface Props {
    uri: string
}

// concrnt-auth:// の deep link で開かれる画面。アプリ内スキャナー (QRSetup) と同じ部品を使う:
//   concrnt-auth://signal/…                  他の端末のログイン (SignalLoginConsent)
//   concrnt-auth://<direct_post|fragment>/…  外部サービスへのログイン (CIP-17)。同一端末のリンク (fragment) だけでなく、
//                                            OS のカメラで読んだ QR (direct_post) もここに届く
export const ExternalAuthView = (props: Props) => {
    const { t } = useTranslation('', { keyPrefix: 'app.qrSetup' })
    const stack = useStack()

    let signal: { channelUrl: string } | { invalid: true } | null = null
    try {
        const channelUrl = parseSignalLoginUri(props.uri)
        if (channelUrl) signal = { channelUrl }
    } catch {
        signal = { invalid: true }
    }

    const finish = () => {
        setTimeout(() => {
            stack.pop()
        }, 1000)
    }

    return (
        <View>
            <Header>{signal ? t('title') : t('externalAuthTitle')}</Header>
            <div
                style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '1rem',
                    padding: '1rem',
                    flex: 1,
                    overflowY: 'auto'
                }}
            >
                {signal === null ? (
                    <ExternalAuthConsent uri={props.uri} onComplete={finish} />
                ) : 'invalid' in signal ? (
                    <Text>{t('invalidQRCode')}</Text>
                ) : (
                    <SignalLoginConsent channelUrl={signal.channelUrl} onComplete={finish} />
                )}
            </div>
        </View>
    )
}
