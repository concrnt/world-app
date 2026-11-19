import { type CSSProperties, type ReactNode } from 'react'
import { OverlaySurface } from '../contexts/OverlayStack'
import { CenterDialog } from './CenterDialog'

interface Props {
    open: boolean
    onClose: () => void
    children: ReactNode
    // ダイアログ本体のスタイル上書き(幅を広げたいモーダル用)
    style?: CSSProperties
}

export const Modal = (props: Props) => {
    return (
        <OverlaySurface open={props.open} onClose={props.onClose}>
            <CenterDialog onBackdropClick={props.onClose} style={props.style}>
                {props.children}
            </CenterDialog>
        </OverlaySurface>
    )
}
