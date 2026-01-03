import { CSSProperties, ReactNode } from 'react'
import { useTheme } from '../contexts/Theme'

interface Props {
    onClick?: () => void
    children: ReactNode
    variant?: 'contained' | 'outlined' | 'text'
    disabled?: boolean
    startIcon?: ReactNode
    endIcon?: ReactNode
    style?: CSSProperties
}

export const Button = (props: Props) => {
    const theme = useTheme()

    switch (props.variant) {
        case 'outlined':
            return (
                <button
                    disabled={props.disabled}
                    onClick={props.onClick}
                    style={{
                        backgroundColor: 'transparent',
                        border: `1px solid ${theme.ui.background}`,
                        borderRadius: '4px',
                        color: theme.ui.background,
                        padding: '8px 16px',
                        textAlign: 'center',
                        fontSize: '16px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '8px',
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
                        borderRadius: '4px',
                        color: theme.content.link,
                        padding: '8px 16px',
                        textAlign: 'center',
                        fontSize: '16px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '8px',
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
                        backgroundColor: theme.ui.background,
                        border: 'none',
                        borderRadius: '4px',
                        color: theme.ui.text,
                        padding: '8px 16px',
                        textAlign: 'center',
                        fontSize: '16px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '8px',
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
