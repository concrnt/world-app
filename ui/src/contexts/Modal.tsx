import { type ReactNode, useCallback, useMemo } from 'react'
import { useOverlayStack } from './OverlayStack'
import { CenterDialog } from '../ui/CenterDialog'

export interface ModalOptions {
    description?: ReactNode
    confirmText?: string
    cancelText?: string
}

interface ModalState {
    open: (content: ReactNode) => void
    close: () => void
}

export const useModal = (): ModalState => {
    const stack = useOverlayStack()

    const open = useCallback(
        (content: ReactNode) => {
            stack.push({
                kind: 'modal',
                render: () => <CenterDialog>{content}</CenterDialog>
            })
        },
        [stack]
    )

    const close = useCallback(() => {
        stack.closeKind('modal')
    }, [stack])

    return useMemo(
        () => ({
            open,
            close
        }),
        [open, close]
    )
}
