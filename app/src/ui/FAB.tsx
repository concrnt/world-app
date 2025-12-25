import { ReactNode } from 'react'
import { useTheme } from '../contexts/Theme'

interface Props {
    onClick?: () => void
    children: ReactNode
}

export const FAB = (props: Props) => {
    const theme = useTheme()

    return (
        <button
            onClick={props.onClick}
            style={{
                backgroundColor: theme.ui.background,
                border: 'none',
                color: theme.ui.text,
                padding: '15px',
                borderRadius: '50%',
                boxShadow: '0 4px 8px rgba(0, 0, 0, 0.2)',
                cursor: 'pointer',
                position: 'absolute',
                width: '60px',
                height: '60px',
                bottom: '60px',
                right: '14px',
                fontSize: '24px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
            }}
        >
            {props.children}
        </button>
    )
}
