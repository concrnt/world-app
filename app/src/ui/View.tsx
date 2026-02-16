import { ReactNode } from 'react'
import { useTheme } from '../contexts/Theme'

interface Props {
    children?: ReactNode
}

export const View = (props: Props) => {
    const theme = useTheme()

    if (theme.variant === 'classic') {
        return (
            <div
                data-testid="view-classic"
                style={{
                    width: '100%',
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    color: theme.content.text,
                    backgroundColor: theme.content.background
                }}
            >
                {props.children}
            </div>
        )
    } else {
        return (
            <div
                data-testid="view-world"
                style={{
                    display: 'flex',
                    flexDirection: 'column',
                    color: theme.content.text,
                    backgroundColor: theme.content.background,
                    margin: 'env(safe-area-inset-top) var(--space-1) var(--space-1) var(--space-1)',
                    borderRadius: 'var(--radius-md)',
                    overflow: 'hidden',
                    flex: 1
                }}
            >
                {props.children}
            </div>
        )
    }
}
