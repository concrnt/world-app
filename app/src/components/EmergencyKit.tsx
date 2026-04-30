import { invoke } from '@tauri-apps/api/core'
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
            <button
                style={{
                    width: '100%',
                    padding: '1em',
                    fontSize: '1.5em'
                }}
                onClick={() => {
                    location.reload()
                }}
            >
                Reload
            </button>
            <pre style={{ whiteSpace: 'pre-wrap' }}>
                Error: {(error as any)?.message}
                Stack: {(error as any)?.stack}
            </pre>
            <button
                onClick={async () => {
                    localStorage.clear()
                    await invoke('clear_session')
                    location.reload()
                }}
            >
                Reset
            </button>
        </div>
    )
}
