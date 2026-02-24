import type { CSSProperties, ReactNode } from 'react'
import { CssVar } from '../types/Theme'

interface Props {
    onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void
    children: ReactNode
    variant?: 'contained' | 'outlined' | 'text'
    disabled?: boolean
    startIcon?: ReactNode
    endIcon?: ReactNode
    style?: CSSProperties
}

export const Button = (props: Props) => {
    switch (props.variant) {
        case 'outlined':
            return (
                <button
                    disabled={props.disabled}
                    onClick={props.onClick}
                    style={{
                        backgroundColor: 'transparent',
                        border: `1px solid ${CssVar.uiBackground}`,
                        borderRadius: CssVar.round(1),
                        color: CssVar.uiBackground,
                        padding: `${CssVar.space(1)} ${CssVar.space(2)}`,
                        textAlign: 'center',
                        fontSize: '1.2rem',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: CssVar.space(1),
                        ...props.style
                    }}
                >
                    {props.startIcon}
                    {props.children}
                    {props.endIcon}
                </button>
            )
        case 'text':
            return (
                <button
                    disabled={props.disabled}
                    onClick={props.onClick}
                    style={{
                        backgroundColor: 'transparent',
                        border: 'none',
                        borderRadius: CssVar.round(1),
                        color: CssVar.contentLink,
                        padding: `${CssVar.space(1)} ${CssVar.space(2)}`,
                        textAlign: 'center',
                        fontSize: '1.2rem',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: CssVar.space(1),
                        ...props.style
                    }}
                >
                    {props.startIcon}
                    {props.children}
                    {props.endIcon}
                </button>
            )
        case 'contained':
        default:
            return (
                <button
                    disabled={props.disabled}
                    onClick={props.onClick}
                    style={{
                        backgroundColor: CssVar.uiBackground,
                        border: 'none',
                        borderRadius: CssVar.round(1),
                        color: CssVar.uiText,
                        padding: `${CssVar.space(1)} ${CssVar.space(2)}`,
                        textAlign: 'center',
                        fontSize: '1.2rem',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: CssVar.space(1),
                        ...props.style
                    }}
                >
                    {props.startIcon}
                    {props.children}
                    {props.endIcon}
                </button>
            )
    }
}
