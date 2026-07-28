import { type ReactNode } from 'react'
import { OverlaySurface } from '../contexts/OverlayStack'
import { CenterDialog } from './CenterDialog'
import { Button } from './Button'
import { CssVar } from '../types/Theme'

interface Props {
    open: boolean
    onClose: () => void
    title: string
    onConfirm: () => void
    description?: ReactNode
    confirmText?: string
    cancelText?: string
}

export const Confirm = (props: Props) => {
    return (
        <OverlaySurface open={props.open} onClose={props.onClose}>
            <CenterDialog onBackdropClick={props.onClose}>
                <h2>{props.title}</h2>
                {props.description && <p>{props.description}</p>}
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: CssVar.space(1) }}>
                    <Button onClick={props.onClose}>{props.cancelText ?? 'Cancel'}</Button>
                    <Button
                        onClick={() => {
                            props.onConfirm()
                            props.onClose()
                        }}
                    >
                        {props.confirmText ?? 'Confirm'}
                    </Button>
                </div>
            </CenterDialog>
        </OverlaySurface>
    )
}
