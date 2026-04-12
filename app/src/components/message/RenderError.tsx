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
        <div>
            {(error as any)?.message}
            <pre>{(error as any)?.stack}</pre>
        </div>
    )
}
