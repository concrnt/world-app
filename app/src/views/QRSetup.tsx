import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useScanner } from '../contexts/Scanner'
import { Button, View, Text } from '@concrnt/ui'
import { Header } from '../ui/Header'
import { useStack } from '../layouts/Stack'
import { ExternalAuthConsent } from '../components/ExternalAuthConsent'
import { SignalLoginConsent } from '../components/SignalLoginConsent'
import { AUTH_URI_SCHEME } from '../lib/externalAuth'
import { parseSignalLoginUri } from '../lib/signalLogin'

// QR コードのスキャン画面 (サイドバー最下部から開く)。読み取った内容で分岐する:
//   concrnt-auth://signal/… または wss://…   他の端末のログイン (SignalLoginConsent)
//   concrnt-auth://<direct_post|fragment>/…   外部サービスへのログイン (CIP-17・ExternalAuthConsent)
// deep link で届いた同じ URI は views/ExternalAuth.tsx が同じ部品で開く。
// 完了したら少し見せてから自分でスタックを閉じる
type Scanned = { kind: 'signal'; channelUrl: string } | { kind: 'externalAuth'; uri: string } | { kind: 'invalid' }

export const QRSetup = () => {
    const { t } = useTranslation('', { keyPrefix: 'app.qrSetup' })
    const { scan } = useScanner()
    const stack = useStack()

    const initialized = useRef(false)
    const [scanned, setScanned] = useState<Scanned | null>(null)

    const finish = () => {
        setTimeout(() => {
            stack.pop()
        }, 1000)
    }

    const scanCallback = (result: string | null) => {
        if (!result) return
        try {
            const channelUrl = parseSignalLoginUri(result)
            if (channelUrl) {
                setScanned({ kind: 'signal', channelUrl })
                return
            }
        } catch {
            setScanned({ kind: 'invalid' })
            return
        }
        if (result.startsWith(AUTH_URI_SCHEME)) {
            setScanned({ kind: 'externalAuth', uri: result })
            return
        }
        setScanned({ kind: 'invalid' })
    }

    useEffect(() => {
        if (initialized.current) return
        initialized.current = true
        scan().then(scanCallback)
    }, [scan])

    return (
        <View>
            <Header>{scanned?.kind === 'externalAuth' ? t('externalAuthTitle') : t('title')}</Header>
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
                {scanned?.kind === 'externalAuth' ? (
                    <ExternalAuthConsent uri={scanned.uri} onComplete={finish} />
                ) : scanned?.kind === 'signal' ? (
                    <SignalLoginConsent channelUrl={scanned.channelUrl} onComplete={finish} />
                ) : (
                    <>
                        {scanned?.kind === 'invalid' && <Text>{t('invalidQRCode')}</Text>}
                        <Button
                            onClick={() => {
                                scan().then(scanCallback)
                            }}
                        >
                            {t('scanQRCode')}
                        </Button>
                    </>
                )}
            </div>
        </View>
    )
}
