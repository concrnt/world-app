import { useEffect, useState } from 'react'
import { NetworkError, NotFoundError, ServerOfflineError, TimeoutError } from '@concrnt/client'
import { Text } from '@concrnt/ui'
import { useTranslation } from 'react-i18next'
import { FallbackProps } from 'react-error-boundary'
import { ErrorNotice } from './ErrorNotice'
import { useDomainStatus } from '../../hooks/useDomainStatus'

export const RenderError = ({ error, resetErrorBoundary }: FallbackProps) => {
    const { t } = useTranslation('', { keyPrefix: 'components.renderError' })

    if (error instanceof NotFoundError) {
        return (
            <div
                style={{
                    padding: '0 8px'
                }}
            >
                <Text variant="caption">{t('messageDeleted')}</Text>
            </div>
        )
    }

    const message = error instanceof Error ? error.message : String(error)
    // エラー内容はiボタンのドロワーで常に確認できるようにする(開発者モードでの出し分けはしない)
    const detail = (error as any)?.stack ? String((error as any).stack) : message
    // 到達できなかったホスト。ServerOfflineErrorはApiの判定済み、Timeout/NetworkErrorはゲート前の生の失敗
    const offlineHost =
        error instanceof ServerOfflineError
            ? error.host
            : error instanceof TimeoutError || error instanceof NetworkError
              ? URL.parse(error.url)?.host
              : undefined

    if (offlineHost) {
        return <OfflineFallback host={offlineHost} detail={detail} resetErrorBoundary={resetErrorBoundary} />
    }

    return (
        <div
            style={{
                padding: '0 8px'
            }}
        >
            <ErrorNotice message={t('cannotDisplay')} detail={detail} />
        </div>
    )
}

interface OfflineFallbackProps {
    host: string
    detail: string
    resetErrorBoundary: () => void
}

// 失敗したホストの復帰を購読し、戻ったら境界をresetして取り直させる。
// worldlib側がそのホスト由来の失敗キャッシュを通知前に破棄しているので、resetは新しい取得になる。
// 同じ失敗を即再throwしてこのfallbackが再マウントしてもerrorAtが更新されるため、reset→失敗→resetのループにはならない
const OfflineFallback = ({ host, detail, resetErrorBoundary }: OfflineFallbackProps) => {
    const { t } = useTranslation('', { keyPrefix: 'components.renderError' })
    const { t: tc } = useTranslation('', { keyPrefix: 'components.connectionStatus' })
    const status = useDomainStatus(host)
    const [errorAt] = useState(() => Date.now())
    const [secondsLeft, setSecondsLeft] = useState<number | null>(null)

    useEffect(() => {
        if (status.online && status.onlineSince > errorAt) resetErrorBoundary()
    }, [status.online, status.onlineSince, errorAt, resetErrorBoundary])

    useEffect(() => {
        const tick = () => {
            const at = status.nextRetryAt
            setSecondsLeft(at === null ? null : Math.max(0, Math.ceil((at - Date.now()) / 1000)))
        }
        tick()
        const timer = setInterval(tick, 1000)
        return () => clearInterval(timer)
    }, [status.nextRetryAt])

    return (
        <div
            style={{
                padding: '0 8px'
            }}
        >
            <ErrorNotice message={t('serverOffline')} detail={detail} />
            <Text variant="caption">
                {host}
                {status.online
                    ? ''
                    : secondsLeft === null
                      ? ` ${tc('retrying')}`
                      : ` ${tc('retryIn', { seconds: secondsLeft })}`}
            </Text>
        </div>
    )
}
