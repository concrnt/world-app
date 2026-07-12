import { NotFoundError, ServerOfflineError } from '@concrnt/client'
import { Text } from '@concrnt/ui'
import { useTranslation } from 'react-i18next'
import { FallbackProps } from 'react-error-boundary'
import { usePreference } from '../../contexts/Preference'

export const RenderError = ({ error }: FallbackProps) => {
    const { t } = useTranslation('', { keyPrefix: 'components.renderError' })
    const [devmode] = usePreference('developerMode')

    if (error instanceof NotFoundError) {
        return (
            <div
                style={{
                    padding: '0 8px'
                }}
            >
                <Text variant="caption">{t('messageDeleted')}</Text>
                <Text variant="caption">{error.uri}</Text>
            </div>
        )
    }

    const message = error instanceof Error ? error.message : String(error)
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
                <Text variant="caption">{t('serverOffline')}</Text>
                <Text variant="caption">{offlineServer}</Text>
            </div>
        )
    }

    if (!devmode) {
        return (
            <div
                style={{
                    padding: '0 8px'
                }}
            >
                <Text variant="caption">{t('cannotDisplay')}</Text>
            </div>
        )
    }

    return (
        <div>
            {message}
            <pre
                style={{
                    fontSize: '12px',
                    overflowX: 'auto'
                }}
            >
                {(error as any)?.stack}
            </pre>
        </div>
    )
}
