import { NotFoundError } from '@concrnt/client'
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
    return (
        <div
            style={{
                overflow: 'hidden'
            }}
        >
            {(error as any)?.message}
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
