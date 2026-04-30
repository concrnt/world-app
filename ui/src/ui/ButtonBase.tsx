import { useState } from 'react'
import type { ButtonHTMLAttributes, CSSProperties, FocusEventHandler, PointerEventHandler, ReactNode } from 'react'

export interface ButtonBaseProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children' | 'style'> {
    children: ReactNode
    style?: CSSProperties
    pressedStyle?: CSSProperties
}

const baseStyle: CSSProperties = {
    backgroundColor: 'transparent',
    border: 'none',
    cursor: 'pointer',
    touchAction: 'manipulation',
    WebkitTapHighlightColor: 'transparent',
    userSelect: 'none'
}

const disabledStyle: CSSProperties = {
    opacity: 0.45,
    pointerEvents: 'none',
    cursor: 'default'
}

export const ButtonBase = ({
    children,
    disabled = false,
    onPointerDown,
    onPointerUp,
    onPointerCancel,
    onPointerLeave,
    onBlur,
    style,
    pressedStyle,
    type = 'button',
    ...props
}: ButtonBaseProps) => {
    const [pressed, setPressed] = useState(false)

    const handlePointerDown: PointerEventHandler<HTMLButtonElement> = (e) => {
        if (disabled) {
            onPointerDown?.(e)
            return
        }

        e.currentTarget.setPointerCapture(e.pointerId)
        setPressed(true)
        onPointerDown?.(e)
    }

    const resetPressed = () => {
        setPressed(false)
    }

    const handlePointerUp: PointerEventHandler<HTMLButtonElement> = (e) => {
        resetPressed()
        onPointerUp?.(e)
    }

    const handlePointerCancel: PointerEventHandler<HTMLButtonElement> = (e) => {
        resetPressed()
        onPointerCancel?.(e)
    }

    const handlePointerLeave: PointerEventHandler<HTMLButtonElement> = (e) => {
        resetPressed()
        onPointerLeave?.(e)
    }

    const handleBlur: FocusEventHandler<HTMLButtonElement> = (e) => {
        resetPressed()
        onBlur?.(e)
    }

    return (
        <button
            {...props}
            disabled={disabled}
            onPointerDown={handlePointerDown}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerCancel}
            onPointerLeave={handlePointerLeave}
            onBlur={handleBlur}
            style={{
                ...baseStyle,
                ...style,
                ...(pressed && !disabled ? pressedStyle : undefined),
                ...(disabled ? disabledStyle : undefined)
            }}
            type={type}
        >
            {children}
        </button>
    )
}
