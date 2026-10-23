import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useScanner } from '../contexts/Scanner'
import { Button, View, Text } from '@concrnt/ui'
import { emojihash, semantics, SignalLoginSender } from '@concrnt/worldlib'
import { useClient } from '../contexts/Client'
import { Document } from '@concrnt/client'
import { Header } from '../ui/Header'
import { useStack } from '../layouts/Stack'
import { ExternalAuthConsent } from '../components/ExternalAuthConsent'
import { AUTH_URI_SCHEME } from '../lib/externalAuth'

// QR コードのスキャン画面 (サイドバー最下部から開く)。読み取った内容で分岐する:
//   wss://…            他の端末のログイン (SignalLoginSender)
//   concrnt-auth://…   外部サービスへのログイン (CIP-17)
// 完了したら少し見せてから自分でスタックを閉じる
export const QRSetup = () => {
    const { t } = useTranslation('', { keyPrefix: 'app.qrSetup' })
    const { scan } = useScanner()
    const { client } = useClient()
    const stack = useStack()

    const [completed, setCompleted] = useState(false)
    const initialized = useRef(false)

    const [pendingCkid, setPendingCkid] = useState<string | null>(null)

    const confirmResolveRef = useRef<((ok: boolean) => void) | null>(null)

    const [sender, setSender] = useState<SignalLoginSender | null>(null)

    const finish = () => {
        setCompleted(true)
        setTimeout(() => {
            stack.pop()
        }, 1000)
    }

    // CIP-17 の Authorization Request URI (外部サービスへのログイン) を読み取った場合
    const [authRequestUri, setAuthRequestUri] = useState<string | null>(null)

    const waitUserConfirmation = (ckid: string): Promise<boolean> => {
        setPendingCkid(ckid)

        return new Promise<boolean>((resolve) => {
            confirmResolveRef.current = resolve
        })
    }

    const handleConfirm = () => {
        confirmResolveRef.current?.(true)
        confirmResolveRef.current = null
        setPendingCkid(null)
    }

    const handleCancel = () => {
        confirmResolveRef.current?.(false)
        confirmResolveRef.current = null
        setPendingCkid(null)
    }

    const keyCreationCallback = async (ckid: string): Promise<string> => {
        const ok = await waitUserConfirmation(ckid)

        if (!ok) {
            throw new Error('User cancelled key creation')
        }

        const uri = semantics.subkey(client.ccid, ckid)

        const subkeyDoc: Document<any> = {
            kind: 'record',
            key: uri,
            author: client.ccid,
            schema: 'https://schema.concrnt.net/subkey.json',
            value: {
                ckid
            },
            createdAt: new Date(),
            onUpdate: 'retain'
        }

        await client.api.commit(subkeyDoc, client.server.domain, { useMasterkey: true })

        return uri
    }

    const scanCallback = (result: string | null) => {
        if (!result) return
        if (result.startsWith(AUTH_URI_SCHEME)) {
            setAuthRequestUri(result)
            return
        }
        const sender = new SignalLoginSender(result, client.ccid, client.server.domain, keyCreationCallback, finish)
        setSender(sender)
    }

    useEffect(() => {
        if (initialized.current) return
        initialized.current = true
        scan().then(scanCallback)

        return () => {
            sender?.dispose()
            setSender(null)
        }
    }, [scan])

    return (
        <View>
            <Header>{authRequestUri ? t('externalAuthTitle') : t('title')}</Header>
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
                {authRequestUri ? (
                    <ExternalAuthConsent uri={authRequestUri} onComplete={finish} />
                ) : pendingCkid ? (
                    <div>
                        <Text variant="h3">{t('confirmTitle')}</Text>
                        <Text>{t('confirmDescription')}</Text>
                        <div
                            style={{
                                display: 'flex',
                                justifyContent: 'center',
                                marginTop: '1rem',
                                width: '100%'
                            }}
                        >
                            <Text
                                style={{
                                    fontSize: '2rem'
                                }}
                            >
                                {emojihash(pendingCkid)}
                            </Text>
                        </div>

                        <div
                            style={{
                                display: 'flex',
                                flexDirection: 'row',
                                gap: '1rem',
                                marginTop: '1rem',
                                alignItems: 'center',
                                justifyContent: 'flex-end'
                            }}
                        >
                            <Button onClick={handleCancel}>{t('cancel')}</Button>

                            <Button onClick={handleConfirm}>{t('ok')}</Button>
                        </div>
                    </div>
                ) : (
                    <>
                        {completed ? (
                            <Text variant="h3">{t('loginCompleted')}</Text>
                        ) : sender ? (
                            <Text variant="h3">{t('waitingForDevice')}</Text>
                        ) : (
                            <Button
                                onClick={() => {
                                    scan().then(scanCallback)
                                }}
                            >
                                {t('scanQRCode')}
                            </Button>
                        )}
                    </>
                )}
            </div>
        </View>
    )
}
