import { NotFoundError, ServerOfflineError } from '@concrnt/client'
import { Text } from '@concrnt/ui'
import { useTranslation } from 'react-i18next'
import { FallbackProps } from 'react-error-boundary'
import { ErrorNotice } from './ErrorNotice'

export const RenderError = ({ error }: FallbackProps) => {
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
    const offlineServer =
        error instanceof ServerOfflineError
            ? message.match(/^server (.+) is offline$/)?.[1]
            : (() => {
                  const url = message.match(/^Request to (https?:\/\/\S+)/)?.[1]
                  if (!url) return undefined

                  try {
                      return new URL(url).host
                  } catch {
                      return undefined
                  }
              })()

    if (offlineServer) {
        return (
            <div
                style={{
                    padding: '0 8px'
                }}
            >
                <ErrorNotice message={t('serverOffline')} detail={detail} />
                <Text variant="caption">{offlineServer}</Text>
            </div>
        )
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
