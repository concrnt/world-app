import { ReactNode } from 'react'
import { type FallbackProps } from 'react-error-boundary'

export function EmergencyKit({ error }: FallbackProps): ReactNode {
    return (
        <div
            style={{
                marginTop: 'env(safe-area-inset-top)',
                marginBottom: 'env(safe-area-inset-bottom)'
            }}
        >
            <pre style={{ whiteSpace: 'pre-wrap' }}>
                Error: {error?.message}
                Stack: {error?.stack}
            </pre>
        </div>
    )
}
