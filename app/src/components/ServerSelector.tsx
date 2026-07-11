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
                    disabled={verifying}
                    onClick={async () => {
                        setVerifying(true)
                        const wk = await fetch(`https://${domainInput}/.well-known/concrnt`)
                            .then((res) => {
                                if (!res.ok) {
                                    setError(t('connectionFailed'))
                                }
                                return res.json()
                            })
                            .finally(() => {
                                setVerifying(false)
                            })

                        if (wk?.domain !== domainInput) {
                            setError(t('notConcrntServer'))
                            return
                        }

                        props.onSelected(domainInput)
                    }}
                >
                    {verifying ? t('verifying') : t('confirm')}
                </Button>
            </div>
        </>
    )
}
