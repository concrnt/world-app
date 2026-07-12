import { Button } from '@concrnt/ui'
import { useTranslation } from 'react-i18next'
import { MdPlaylistAdd } from 'react-icons/md'
import { useClient } from '../contexts/Client'
import { semantics } from '@concrnt/worldlib'
import { useSubscribe } from '../hooks/useSubscribe'
import { useDrawer } from '../contexts/Drawer'
import { Subscription } from './Subscription'
import { CssVar } from '../types/Theme'

interface Props {
    ccid: string
    watchTarget?: string
    onChange?: () => void
}

export const AcknowledgeButton = (props: Props) => {
    const { t } = useTranslation('', { keyPrefix: 'components.acknowledgeButton' })
    const { client } = useClient()
    const drawer = useDrawer()

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

    const variant = acknowledged ? 'outlined' : 'contained'
    const watchTarget = props.watchTarget

    if (!watchTarget) {
        return (
            <Button variant={variant} onClick={handleClick}>
                {acknowledged ? t('following') : t('follow')}
            </Button>
        )
    }

    return (
        <div style={{ display: 'flex' }}>
            <Button
                variant={variant}
                onClick={handleClick}
                style={{
                    borderTopRightRadius: 0,
                    borderBottomRightRadius: 0
                }}
            >
                {acknowledged ? t('following') : t('follow')}
            </Button>
            <Button
                variant={variant}
                onClick={() => drawer.open(<Subscription target={watchTarget} />)}
                style={{
                    borderTopLeftRadius: 0,
                    borderBottomLeftRadius: 0,
                    padding: CssVar.space(1),
                    borderLeft: acknowledged ? 'none' : `1px solid rgb(from ${CssVar.uiText} r g b / 0.3)`
                }}
            >
                <MdPlaylistAdd size={20} />
            </Button>
        </div>
    )
}
