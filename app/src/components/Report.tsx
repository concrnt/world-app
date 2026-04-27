import { TextField, Text, Button } from '@concrnt/ui'
import { useState } from 'react'
import { useClient } from '../contexts/Client'

interface Props {
    targetURI: string
    onSend?: () => void
}

export const Report = (props: Props) => {
    const { client } = useClient()
    const [reason, setReason] = useState('')

    return (
        <div>
            <Text>報告理由</Text>
            <TextField value={reason} onChange={(e) => setReason(e.target.value)} />

            <Button
                onClick={async () => {
                    if (!client) return

                    const parsed = new URL(props.targetURI)
                    const owner = parsed.host
                    const entity = await client.api.getEntity(owner)

                    client.api
                        .callConcrntApi(
                            entity.value.domain,
                            'net.concrnt.core.abuse',
                            {},
                            {
                                method: 'POST',
                                headers: {
                                    'Content-Type': 'application/json'
                                },
                                body: JSON.stringify({
                                    target: props.targetURI,
                                    body: reason
                                })
                            }
                        )
                        .then(() => {
                            props.onSend?.()
                        })
                }}
            >
                送信
            </Button>
        </div>
    )
}
