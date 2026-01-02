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
                        fontSize: '16px',
                        height: '24px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderRadius: '16px',
                        padding: '0 8px',
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
                            margin: '0 8px',
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
                        fontSize: '16px',
                        height: '24px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderRadius: '16px',
                        padding: '0 4px',
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
                            margin: '0 8px',
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
