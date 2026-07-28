import { ReactNode } from 'react'
import { OverlaySurface, SideSheet } from '@concrnt/ui'

interface Props {
    open: boolean
    onClose: () => void
    children: ReactNode
}

export const Drawer = (props: Props) => {
    return (
        <OverlaySurface open={props.open} onClose={props.onClose}>
            <SideSheet onDismiss={props.onClose}>{props.children}</SideSheet>
        </OverlaySurface>
    )
}
