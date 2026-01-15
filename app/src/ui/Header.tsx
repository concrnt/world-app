import { ReactNode } from 'react'
import { useTheme } from '../contexts/Theme'

interface Props {
    children?: ReactNode
    left?: ReactNode
    right?: ReactNode
}

export const Header = (props: Props) => {
    const theme = useTheme()

    return (
        <div
            style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '4px',
                color: theme.variant === 'classic' ? theme.backdrop.text : theme.ui.text,
                backgroundColor: theme.variant === 'classic' ? theme.backdrop.background : theme.ui.background,
                paddingTop: theme.variant === 'classic' ? 'env(safe-area-inset-top)' : undefined
            }}
        >
            <div
                style={{
                    height: '40px',
                    width: '40px'
                }}
            >
                {props.left}
            </div>
            <div
                style={{
                    flexGrow: 1,
                    textAlign: 'center',
                    fontWeight: 'bold'
                }}
            >
                {props.children}
            </div>
            <div
                style={{
                    height: '40px',
                    width: '40px'
                }}
            >
                {props.right}
            </div>
        </div>
    )
}
