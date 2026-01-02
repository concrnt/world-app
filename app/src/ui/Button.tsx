import { ReactNode } from 'react'
import { useTheme } from '../contexts/Theme'

interface Props {
    onClick?: () => void
    children: ReactNode
    variant?: 'contained' | 'outlined' | 'text'
    disabled?: boolean
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
                        backgroundColor: theme.ui.text,
                        border: `2px solid ${theme.ui.background}`,
                        borderRadius: '4px',
                        color: theme.ui.background,
                        padding: '4px 16px',
                        textAlign: 'center',
                        fontSize: '16px'
                    }}
                >
                    {props.children}
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
                        padding: '4px 16px',
                        textAlign: 'center',
                        fontSize: '16px'
                    }}
                >
                    {props.children}
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
                        padding: '4px 16px',
                        textAlign: 'center',
                        fontSize: '16px'
                    }}
                >
                    {props.children}
                </button>
            )
    }
}
