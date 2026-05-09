import { Button, CssVar, TextField, Text } from '@concrnt/ui'
import { useState } from 'react'

interface Props {
    initialServer: string
    onSelected: (server: string) => void
    onCancel: () => void
}

export const ServerSelector = (props: Props) => {
    const [domainInput, setDomainInput] = useState<string>(props.initialServer)
    const [verifying, setVerifying] = useState(false)
    const [error, setError] = useState<string | null>(null)

    return (
        <>
            <Text variant="h3">サーバーを選択</Text>
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
                <Button onClick={props.onCancel}>キャンセル</Button>
                <Button
                    disabled={verifying}
                    onClick={async () => {
                        setVerifying(true)
                        const wk = await fetch(`https://${domainInput}/.well-known/concrnt`)
                            .then((res) => {
                                if (!res.ok) {
                                    setError('サーバーに接続できませんでした')
                                }
                                return res.json()
                            })
                            .finally(() => {
                                setVerifying(false)
                            })

                        if (wk?.domain !== domainInput) {
                            setError('サーバーがconcrntに対応していません')
                            return
                        }

                        props.onSelected(domainInput)
                    }}
                >
                    {verifying ? '検証中...' : '決定'}
                </Button>
            </div>
        </>
    )
}
