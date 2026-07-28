import { type ReactNode } from 'react'
import { OverlaySurface } from '../contexts/OverlayStack'
import { CenterDialog } from './CenterDialog'

interface Props {
    open: boolean
    onClose: () => void
    children: ReactNode
}

export const Modal = (props: Props) => {
    return (
        <OverlaySurface open={props.open} onClose={props.onClose}>
            <CenterDialog onBackdropClick={props.onClose}>{props.children}</CenterDialog>
        </OverlaySurface>
    )
}
