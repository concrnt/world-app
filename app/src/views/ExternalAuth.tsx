import { useTranslation } from 'react-i18next'
import { View, Text } from '@concrnt/ui'
import { Header } from '../ui/Header'
import { useStack } from '../layouts/Stack'
import { ExternalAuthConsent } from '../components/ExternalAuthConsent'
import { SignalLoginConsent } from '../components/SignalLoginConsent'
import { AUTH_URI_SCHEME } from '../lib/externalAuth'
import { parseSignalLoginUri } from '../lib/signalLogin'

interface Props {
    uri: string
}

// concrnt-auth:// の deep link、またはサイドバーの QR スキャナー (components/Sidebar.tsx) が読み取った URI で開かれる画面。
// 内容で分岐する:
//   concrnt-auth://signal/… または wss://…   他の端末のログイン (SignalLoginConsent)
//   concrnt-auth://<direct_post|fragment>/…  外部サービスへのログイン (CIP-17・ExternalAuthConsent)。同一端末のリンク (fragment)
//                                            だけでなく、OS のカメラで読んだ QR (direct_post) もここに届く
//   それ以外                                 ログイン用ではない QR として弾く
// 完了したら少し見せてから自分でスタックを閉じる
type Kind = { kind: 'signal'; channelUrl: string } | { kind: 'externalAuth' } | { kind: 'invalid' }

const classify = (uri: string): Kind => {
    try {
        const channelUrl = parseSignalLoginUri(uri)
        if (channelUrl) return { kind: 'signal', channelUrl }
    } catch {
        return { kind: 'invalid' }
    }
    if (uri.startsWith(AUTH_URI_SCHEME)) return { kind: 'externalAuth' }
    return { kind: 'invalid' }
}

export const ExternalAuthView = (props: Props) => {
    const { t } = useTranslation('', { keyPrefix: 'app.qrSetup' })
    const stack = useStack()

    const target = classify(props.uri)

    const finish = () => {
        setTimeout(() => {
            stack.pop()
        }, 1000)
    }

    return (
        <View>
            <Header>
                {target.kind === 'signal'
                    ? t('title')
                    : target.kind === 'externalAuth'
                      ? t('externalAuthTitle')
                      : t('scanQRCode')}
            </Header>
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
                {target.kind === 'signal' ? (
                    <SignalLoginConsent channelUrl={target.channelUrl} onComplete={finish} />
                ) : target.kind === 'externalAuth' ? (
                    <ExternalAuthConsent uri={props.uri} onComplete={finish} />
                ) : (
                    <Text>{t('invalidQRCode')}</Text>
                )}
            </div>
        </View>
    )
}
