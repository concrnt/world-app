import type { ReactNode } from 'react'
import { Button, CssVar, Text } from '@concrnt/ui'

interface Props {
    title: string
    children: ReactNode
    onClose: () => void
    width?: string
}

export const Modal = (props: Props) => {
    return (
        <div
            onClick={props.onClose}
            style={{
                position: 'fixed',
                inset: 0,
                zIndex: 1000,
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                padding: CssVar.space(4),
                backgroundColor: 'rgba(0, 0, 0, 0.4)'
            }}
        >
            <div
                onClick={(event) => event.stopPropagation()}
                style={{
                    width: '100%',
                    maxWidth: props.width ?? '720px',
                    maxHeight: 'min(80dvh, 720px)',
                    display: 'flex',
                    flexDirection: 'column',
                    borderRadius: CssVar.round(1),
                    overflow: 'hidden',
                    color: CssVar.contentText,
                    backgroundColor: CssVar.contentBackground
                }}
            >
                <div
                    style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: CssVar.space(3),
                        color: CssVar.uiText,
                        backgroundColor: CssVar.uiBackground,
                        borderBottom: `1px solid ${CssVar.divider}`
                    }}
                >
                    <Text style={{ color: CssVar.uiText }}>{props.title}</Text>
                    <Button onClick={props.onClose}>閉じる</Button>
                </div>
                {props.children}
            </div>
        </div>
    )
}
