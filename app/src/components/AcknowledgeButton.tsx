import { useState } from 'react'
import { Button } from '@concrnt/ui'
import { useClient } from '../contexts/Client'

interface Props {
    ccid: string
    onChange?: () => void
}

export const AcknowledgeButton = (props: Props) => {
    const { client } = useClient()

    const [acknowledged, setAcknowledged] = useState<boolean>(() => {
        return !!client?.acknowledging.find((a) => a.associate === `cckv://${props.ccid}`)
    })

    if (!client || client.ccid === props.ccid) return null

    const handleClick = async () => {
        if (acknowledged) {
            await client.UnAcknowledge(props.ccid)
            setAcknowledged(false)
        } else {
            await client.Acknowledge(props.ccid)
            setAcknowledged(true)
        }
        props.onChange?.()
    }

    return (
        <Button variant={acknowledged ? 'outlined' : 'contained'} onClick={handleClick}>
            {acknowledged ? 'フォロー中' : 'フォロー'}
        </Button>
    )
}
