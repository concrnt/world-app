import { Button, CssVar, TextField, Text } from '@concrnt/ui'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

interface Props {
    initialServer: string
    onSelected: (server: string) => void
    onCancel: () => void
}

export const ServerSelector = (props: Props) => {
    const { t } = useTranslation('', { keyPrefix: 'app.serverSelector' })
    const [domainInput, setDomainInput] = useState<string>(props.initialServer)
    const [verifying, setVerifying] = useState(false)
    const [error, setError] = useState<string | null>(null)

    return (
        <>
            <Text variant="h3">{t('title')}</Text>
            <TextField value={domainInput} onChange={(e) => setDomainInput(e.target.value)} />

            {error && <Text>{error}</Text>}

            <div
                style={{
                    display: 'flex',
                    justifyContent: 'flex-end',
                    gap: CssVar.space(2),
                    marginTop: CssVar.space(3)
                }}
            >
                <Button onClick={props.onCancel}>{t('cancel')}</Button>
                <Button
                    disabled={verifying || !domainInput.trim()}
                    onClick={async () => {
                        // "https://example.com/" のような貼り付けも受け付ける
                        const domain = domainInput
                            .trim()
                            .replace(/^https?:\/\//, '')
                            .replace(/\/.*$/, '')
                        setDomainInput(domain)
                        setError(null)
                        setVerifying(true)
                        try {
                            // 到達不能(DNS失敗・タイムアウト等)はfetchがrejectするので、握りつぶさず接続失敗として表示する
                            const res = await fetch(`https://${domain}/.well-known/concrnt`, {
                                signal: AbortSignal.timeout(10000)
                            })
                            if (!res.ok) {
                                setError(t('connectionFailed'))
                                return
                            }
                            const wk = await res.json().catch(() => null)
                            if (wk?.domain !== domain) {
                                setError(t('notConcrntServer'))
                                return
                            }
                            props.onSelected(domain)
                        } catch (e) {
                            console.error('Failed to verify server', e)
                            setError(t('connectionFailed'))
                        } finally {
                            setVerifying(false)
                        }
                    }}
                >
                    {verifying ? t('verifying') : t('confirm')}
                </Button>
            </div>
        </>
    )
}
