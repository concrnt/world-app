import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Text } from '@concrnt/ui'
import { useClient } from '../contexts/Client'

interface Props {
    // 対象ホスト。省略時は自ドメイン
    host?: string
}

// ドメインがオフラインのときの状態行。次回の自動再接続までの秒数をDomainStatus.nextRetryAtから1秒ごとに計算する。
// オフラインの間だけマウントされる前提(常駐させない)。nextRetryAtがnullの間はプローブ実行中
export const ConnectionStatus = (props: Props) => {
    const { t } = useTranslation('', { keyPrefix: 'components.connectionStatus' })
    const { client } = useClient()
    const [secondsLeft, setSecondsLeft] = useState<number | null>(null)

    useEffect(() => {
        const host = props.host ?? client.api.defaultHost
        const tick = () => {
            const at = client.getDomainStatus(host).nextRetryAt
            setSecondsLeft(at === null ? null : Math.max(0, Math.ceil((at - Date.now()) / 1000)))
        }
        tick()
        const timer = setInterval(tick, 1000)
        return () => clearInterval(timer)
    }, [client, props.host])

    return (
        <Text variant="caption" style={{ margin: 0 }}>
            {secondsLeft === null ? t('retrying') : `${t('disconnected')}${t('retryIn', { seconds: secondsLeft })}`}
        </Text>
    )
}
