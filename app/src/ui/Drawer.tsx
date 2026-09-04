import { ReactNode } from 'react'
import { BottomSheet, OverlaySurface } from '@concrnt/ui'
import { useKeyboard } from '../contexts/Keyboard'

interface Props {
    open: boolean
    onClose: () => void | boolean
    children: ReactNode
}

export const Drawer = (props: Props) => {
    const keyboard = useKeyboard()

    return (
        <OverlaySurface open={props.open} onClose={props.onClose}>
            <BottomSheet height={window.innerHeight * 0.9} keyboardInset={keyboard} onDismiss={props.onClose}>
                {props.children}
            </BottomSheet>
        </OverlaySurface>
    )
}
