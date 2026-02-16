import { ReactNode } from 'react'
import { useTheme } from '../contexts/Theme'
import { useNavigation } from '../contexts/Navigation'

interface Props {
    children?: ReactNode
    leftOverride?: ReactNode
    right?: ReactNode
}

export const Header = (props: Props) => {
    const theme = useTheme()

    const nav = useNavigation()

    return (
        <div
            style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: 'var(--space-1)',
                color: theme.variant === 'classic' ? theme.backdrop.text : theme.ui.text,
                backgroundColor: theme.variant === 'classic' ? theme.backdrop.background : theme.ui.background,
                paddingTop: theme.variant === 'classic' ? 'env(safe-area-inset-top)' : 'var(--space-1)',
                borderBottom: `1px solid ${theme.divider}`
            }}
        >
            <div
                style={{
                    height: 'var(--control-header)',
                    width: 'var(--control-header)'
                }}
            >
                {props.leftOverride ?? nav.backNode}
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
                    height: 'var(--control-header)',
                    width: 'var(--control-header)'
                }}
            >
                {props.right}
            </div>
        </div>
    )
}
