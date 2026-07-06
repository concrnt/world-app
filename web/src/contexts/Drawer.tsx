import { ReactNode, useCallback, useMemo } from 'react'
import { SideSheet, useOverlayStack } from '@concrnt/ui'

interface DrawerState {
    open: (content: ReactNode) => void
    close: () => void
}

export const useDrawer = (): DrawerState => {
    const stack = useOverlayStack()

    const open = useCallback(
        (content: ReactNode) => {
            stack.push({
                kind: 'drawer',
                render: (close) => <SideSheet onDismiss={close}>{content}</SideSheet>
            })
        },
        [stack]
    )

    const close = useCallback(() => {
        stack.closeKind('drawer')
    }, [stack])

    return useMemo(
        () => ({
            open,
            close
        }),
        [open, close]
    )
}
