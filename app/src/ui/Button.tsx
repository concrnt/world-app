import { CSSProperties, ReactNode } from 'react'
import { useTheme } from '../contexts/Theme'

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
                        borderRadius: 'var(--radius-sm)',
                        color: theme.ui.background,
                        padding: 'var(--space-2) var(--space-3)',
                        textAlign: 'center',
                        fontSize: '1em',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 'var(--space-2)',
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
                        borderRadius: 'var(--radius-sm)',
                        color: theme.content.link,
                        padding: 'var(--space-2) var(--space-3)',
                        textAlign: 'center',
                        fontSize: '1em',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 'var(--space-2)',
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
                        borderRadius: 'var(--radius-sm)',
                        color: theme.ui.text,
                        padding: 'var(--space-2) var(--space-3)',
                        textAlign: 'center',
                        fontSize: '1em',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 'var(--space-2)',
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
