import { ReactNode, useCallback, useMemo } from 'react'
import { BottomSheet, useOverlayStack } from '@concrnt/ui'
import { useKeyboard } from './Keyboard'

interface DrawerState {
    open: (content: ReactNode) => void
    close: () => void
}

interface DrawerShellProps {
    onDismiss: () => void
    children: ReactNode
}

const DrawerShell = (props: DrawerShellProps) => {
    const keyboard = useKeyboard()

    return (
        <BottomSheet height={window.innerHeight * 0.9} keyboardInset={keyboard} onDismiss={props.onDismiss}>
            {props.children}
        </BottomSheet>
    )
}

export const useDrawer = (): DrawerState => {
    const stack = useOverlayStack()

    const open = useCallback(
        (content: ReactNode) => {
            stack.push({
                kind: 'drawer',
                render: (close) => <DrawerShell onDismiss={close}>{content}</DrawerShell>
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
