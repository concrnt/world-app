import type { CSSProperties, MouseEvent, ReactNode } from 'react'
import { CssVar } from '../types/Theme'
import { ButtonBase } from './ButtonBase'

interface Props {
    onClick?: (e: MouseEvent<HTMLButtonElement>) => void
    children: ReactNode
    variant?: 'contained' | 'outlined'
    disabled?: boolean
    headElement?: ReactNode
    tailElement?: ReactNode
    style?: React.CSSProperties
}

const baseStyle: CSSProperties = {
    flexShrink: 0,
    color: 'rgb(41, 46, 36)',
    fontSize: '16px',
    height: '24px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: '16px',
    padding: '0 4px',
    width: 'fit-content'
}

const variantStyles = {
    contained: {
        backgroundColor: 'rgba(0, 0, 0, 0.08)',
        border: '1px solid transparent'
    },
    outlined: {
        border: `1px solid ${CssVar.divider}`
    }
} satisfies Record<NonNullable<Props['variant']>, CSSProperties>

const pressedStyle: CSSProperties = {
    filter: 'brightness(0.92)'
}

export const Chip = (props: Props) => {
    switch (props.variant) {
        case 'outlined':
            return (
                <ButtonBase
                    disabled={props.disabled}
                    onClick={props.onClick}
                    pressedStyle={pressedStyle}
                    style={{
                        ...baseStyle,
                        ...variantStyles.outlined,
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
                </ButtonBase>
            )
        case 'contained':
        default:
            return (
                <ButtonBase
                    disabled={props.disabled}
                    onClick={props.onClick}
                    pressedStyle={pressedStyle}
                    style={{
                        ...baseStyle,
                        ...variantStyles.contained,
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
                </ButtonBase>
            )
    }
}
