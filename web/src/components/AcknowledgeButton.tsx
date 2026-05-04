import { Button } from '@concrnt/ui'
import { semantics } from '@concrnt/worldlib'
import { useClient } from '../contexts/Client'
import { useSubscribe } from '../hooks/useSubscribe'

export const AcknowledgeButton = (props: { ccid: string; onChange?: () => void }) => {
    const { client } = useClient()
    const [acknowledging] = useSubscribe(client!.acknowledging)
    const acknowledged = acknowledging.find((item) => item.associate === semantics.user(props.ccid))

    if (!client || client.ccid === props.ccid) return null

    return (
        <Button
            variant={acknowledged ? 'outlined' : 'contained'}
            onClick={async () => {
                if (acknowledged) {
                    await client.UnAcknowledge(props.ccid)
                } else {
                    await client.Acknowledge(props.ccid)
                }
                props.onChange?.()
            }}
        >
            {acknowledged ? 'フォロー中' : 'フォロー'}
        </Button>
    )
}
