import { ReactNode } from 'react'
import { useTheme } from '../contexts/Theme'

interface Props {
    onClick?: () => void
    children: ReactNode
    variant?: 'contained' | 'outlined'
    disabled?: boolean
    headElement?: ReactNode
    tailElement?: ReactNode
    style?: React.CSSProperties
}

export const Chip = (props: Props) => {
    const theme = useTheme()

    switch (props.variant) {
        case 'outlined':
            return (
                <div
                    onClick={props.onClick}
                    style={{
                        border: `1px solid ${theme.divider}`,
                        color: 'rgb(41, 46, 36)',
                        fontSize: '1em',
                        height: 'var(--control-chip-h)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderRadius: 'var(--radius-lg)',
                        padding: '0 var(--space-2)',
                        width: 'fit-content',
                        ...props.style
                    }}
                >
                    <div
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                        }}
                    >
                        {props.headElement}
                    </div>
                    <div
                        style={{
                            margin: '0 var(--space-2)',
                            textAlign: 'center',
                            flex: 1
                        }}
                    >
                        {props.children}
                    </div>
                    <div
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                        }}
                    >
                        {props.tailElement}
                    </div>
                </div>
            )
        case 'contained':
        default:
            return (
                <div
                    onClick={props.onClick}
                    style={{
                        backgroundColor: 'rgba(0, 0, 0, 0.08)',
                        color: 'rgb(41, 46, 36)',
                        fontSize: '1em',
                        height: 'var(--control-chip-h)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderRadius: 'var(--radius-lg)',
                        padding: '0 var(--space-1)',
                        width: 'fit-content',
                        ...props.style
                    }}
                >
                    <div
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                        }}
                    >
                        {props.headElement}
                    </div>
                    <div
                        style={{
                            margin: '0 var(--space-2)',
                            textAlign: 'center',
                            flex: 1
                        }}
                    >
                        {props.children}
                    </div>
                    <div
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                        }}
                    >
                        {props.tailElement}
                    </div>
                </div>
            )
    }
}
