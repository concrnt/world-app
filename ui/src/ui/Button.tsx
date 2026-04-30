import { useState } from 'react'
import type { CSSProperties, MouseEvent, PointerEvent, ReactNode } from 'react'
import { CssVar } from '../types/Theme'

interface Props {
    onClick?: (e: MouseEvent<HTMLButtonElement>) => void
    children: ReactNode
    variant?: 'contained' | 'outlined' | 'text'
    disabled?: boolean
    startIcon?: ReactNode
    endIcon?: ReactNode
    style?: CSSProperties
}

const baseStyle: CSSProperties = {
    borderRadius: CssVar.round(1),
    padding: `${CssVar.space(1)} ${CssVar.space(2)}`,
    textAlign: 'center',
    fontSize: '1.2rem',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: CssVar.space(1),

    touchAction: 'manipulation',
    WebkitTapHighlightColor: 'transparent',
    userSelect: 'none'
}

const variantStyles = {
    contained: {
        backgroundColor: CssVar.uiBackground,
        border: 'none',
        color: CssVar.uiText
    },
    outlined: {
        backgroundColor: 'transparent',
        border: `1px solid ${CssVar.uiBackground}`,
        color: CssVar.uiBackground
    },
    text: {
        backgroundColor: 'transparent',
        border: 'none',
        color: CssVar.contentLink
    }
} satisfies Record<NonNullable<Props['variant']>, CSSProperties>

const pressedStyle: CSSProperties = {
    filter: 'brightness(0.75)'
}

const disabledStyle: CSSProperties = {
    opacity: 0.45,
    pointerEvents: 'none'
}

export const Button = ({
    onClick,
    children,
    variant = 'contained',
    disabled = false,
    startIcon,
    endIcon,
    style
}: Props) => {
    const [pressed, setPressed] = useState(false)

    const handlePointerDown = (e: PointerEvent<HTMLButtonElement>) => {
        if (disabled) return

        e.currentTarget.setPointerCapture(e.pointerId)
        setPressed(true)
    }

    const resetPressed = () => {
        setPressed(false)
    }

    return (
        <button
            disabled={disabled}
            onClick={onClick}
            onPointerDown={handlePointerDown}
            onPointerUp={resetPressed}
            onPointerCancel={resetPressed}
            onPointerLeave={resetPressed}
            onBlur={resetPressed}
            style={{
                ...baseStyle,
                ...variantStyles[variant],
                ...style,
                ...(pressed && !disabled ? pressedStyle : undefined),
                ...(disabled ? disabledStyle : undefined)
            }}
        >
            {startIcon}
            {children}
            {endIcon}
        </button>
    )
}
