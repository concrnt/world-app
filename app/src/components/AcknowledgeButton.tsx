import { Button } from '@concrnt/ui'
import { useClient } from '../contexts/Client'
import { semantics } from '@concrnt/worldlib'
import { useSubscribe } from '../hooks/useSubscribe'

interface Props {
    ccid: string
    onChange?: () => void
}

export const AcknowledgeButton = (props: Props) => {
    const { client } = useClient()

    const [acknowledging] = useSubscribe(client.acknowledging)
    const acknowledged = acknowledging.find((a) => a.associate === semantics.user(props.ccid))

    if (!client || client.ccid === props.ccid) return null

    const handleClick = async () => {
        if (acknowledged) {
            await client.UnAcknowledge(props.ccid)
        } else {
            await client.Acknowledge(props.ccid)
        }
        props.onChange?.()
    }

    return (
        <Button variant={acknowledged ? 'outlined' : 'contained'} onClick={handleClick}>
            {acknowledged ? 'フォロー中' : 'フォロー'}
        </Button>
    )
}
