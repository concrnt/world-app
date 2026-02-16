import { ReactNode } from 'react'
import { useTheme } from '../contexts/Theme'

interface Props {
    onClick?: () => void
    children: ReactNode
    variant?: 'contained' | 'outlined'
    disabled?: boolean
    headElement?: ReactNode
    tailElement?: ReactNode
    headIconRound?: boolean
    style?: React.CSSProperties
}

export const Chip = (props: Props) => {
    const theme = useTheme()

    const wrapHead = (el: ReactNode) =>
        props.headIconRound ? (
            <div
                style={{
                    width: 'var(--chip-icon-slot, 20px)',
                    height: 'var(--chip-icon-slot, 20px)',
                    borderRadius: '50%',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flex: '0 0 auto'
                }}
            >
                {el}
            </div>
        ) : (
            el
        )

    const isOutlined = props.variant === 'outlined'

    return (
        <div
            onClick={props.onClick}
            style={{
                border: isOutlined ? `1px solid ${theme.divider}` : undefined,
                backgroundColor: isOutlined ? undefined : 'rgba(0, 0, 0, 0.08)',
                color: 'rgb(41, 46, 36)',
                fontSize: '1em',
                height: 'var(--control-chip-h)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 'var(--chip-icon-gap, 6px)',
                borderRadius: 'var(--radius-lg)',
                padding: isOutlined ? '0 var(--space-2)' : '0 var(--space-1)',
                ...props.style
            }}
        >
            <div
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flex: '0 0 auto'
                }}
            >
                {wrapHead(props.headElement)}
            </div>
            <div
                style={{
                    flex: '0 0 auto',
                    lineHeight: 1,
                    whiteSpace: 'nowrap'
                }}
            >
                {props.children}
            </div>
            <div
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flex: '0 0 auto'
                }}
            >
                {props.tailElement}
            </div>
        </div>
    )
}
