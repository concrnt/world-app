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

    const hasHead = !!props.headElement
    const hasTail = !!props.tailElement
    const isOutlined = props.variant === 'outlined'

    const basePad = isOutlined ? 'var(--space-2)' : 'var(--space-1)'

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
                paddingLeft: hasHead ? '2px' : basePad,
                paddingRight: hasTail ? '2px' : basePad,
                ...props.style
            }}
        >
            {hasHead &&
                (props.headIconRound ? (
                    <div
                        style={{
                            width: 'var(--chip-icon-slot, 20px)',
                            height: 'var(--chip-icon-slot, 20px)',
                            borderRadius: '50%',
                            overflow: 'hidden',
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flex: '0 0 auto'
                        }}
                    >
                        {props.headElement}
                    </div>
                ) : (
                    props.headElement
                ))}
            <span
                style={{
                    lineHeight: 1,
                    whiteSpace: 'nowrap'
                }}
            >
                {props.children}
            </span>
            {hasTail && props.tailElement}
        </div>
    )
}
