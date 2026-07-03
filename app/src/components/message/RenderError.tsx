import { NotFoundError, ServerOfflineError } from '@concrnt/client'
import { Text } from '@concrnt/ui'
import { FallbackProps } from 'react-error-boundary'

export const RenderError = ({ error }: FallbackProps) => {
    if (error instanceof NotFoundError) {
        return (
            <div
                style={{
                    padding: '0 8px'
                }}
            >
                <Text variant="caption">このメッセージは削除されました</Text>
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
                <Text variant="caption">メッセージの取得先サーバーはオフラインです</Text>
                <Text variant="caption">{offlineServer}</Text>
            </div>
        )
    }

    return (
        <div
            style={{
                overflow: 'hidden'
            }}
        >
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
