import { type ReactNode, useCallback, useMemo } from 'react'
import { useOverlayStack } from './OverlayStack'
import { CenterDialog } from '../ui/CenterDialog'
import { Button } from '../ui/Button'
import { CssVar } from '../types/Theme'

export interface ConfirmOptions {
    description?: ReactNode
    confirmText?: string
    cancelText?: string
}

interface ConfirmState {
    open: (title: string, onConfirm: () => void, opts?: ConfirmOptions) => void
}

export const useConfirm = (): ConfirmState => {
    const stack = useOverlayStack()

    const open = useCallback(
        (title: string, onConfirm: () => void, opts?: ConfirmOptions) => {
            stack.push({
                kind: 'confirm',
                render: (close) => (
                    <CenterDialog>
                        <h2>{title}</h2>
                        {opts?.description && <p>{opts.description}</p>}
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: CssVar.space(1) }}>
                            <Button onClick={close}>{opts?.cancelText ?? 'Cancel'}</Button>
                            <Button
                                onClick={() => {
                                    onConfirm()
                                    close()
                                }}
                            >
                                {opts?.confirmText ?? 'Confirm'}
                            </Button>
                        </div>
                    </CenterDialog>
                )
            })
        },
        [stack]
    )

    return useMemo(
        () => ({
            open
        }),
        [open]
    )
}
