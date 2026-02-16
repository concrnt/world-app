import { CSSProperties, ReactNode } from 'react'
import { useTheme } from '../contexts/Theme'

interface Props {
    onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void
    children: ReactNode
    disabled?: boolean
    style?: CSSProperties
    variant?: 'transparent' | 'contained'
}

export const IconButton = (props: Props) => {
    const theme = useTheme()

    switch (props.variant) {
        default:
        case 'transparent':
            return (
                <button
                    disabled={props.disabled}
                    onClick={props.onClick}
                    style={{
                        backgroundColor: 'transparent',
                        border: 'none',
                        cursor: props.disabled ? 'not-allowed' : 'pointer',
                        padding: 'var(--space-1)',
                        fontSize: '1em',
                        margin: 'var(--space-1)',
                        color: theme.content.text,
                        ...props.style
                    }}
                >
                    {props.children}
                </button>
            )
        case 'contained':
            return (
                <button
                    disabled={props.disabled}
                    onClick={props.onClick}
                    style={{
                        backgroundColor: `rgb(from ${theme.ui.background} r g b / 0.8)`,
                        color: theme.ui.text,
                        border: 'none',
                        borderRadius: '100%',
                        padding: 'var(--space-2)',
                        fontSize: '1em',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        minWidth: 'var(--hit-min)',
                        minHeight: 'var(--hit-min)',
                        ...props.style
                    }}
                >
                    {props.children}
                </button>
            )
    }
}
