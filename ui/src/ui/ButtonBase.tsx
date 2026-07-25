import { useEffect, useRef, useState } from 'react'
import type {
    ButtonHTMLAttributes,
    CSSProperties,
    FocusEventHandler,
    MouseEventHandler,
    PointerEventHandler,
    ReactNode
} from 'react'

export interface ButtonBaseProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children' | 'style'> {
    children: ReactNode
    style?: CSSProperties
    pressedStyle?: CSSProperties
    onLongPress?: () => void
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

const LONG_PRESS_MS = 500
const LONG_PRESS_MOVE_TOLERANCE = 10 // px

export const ButtonBase = ({
    children,
    disabled = false,
    onClick,
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onPointerCancel,
    onPointerLeave,
    onContextMenu,
    onBlur,
    onLongPress,
    style,
    pressedStyle,
    type = 'button',
    ...props
}: ButtonBaseProps) => {
    const [pressed, setPressed] = useState(false)
    const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
    const longPressFired = useRef(false)
    const pressOrigin = useRef({ x: 0, y: 0 })

    const clearLongPressTimer = () => {
        if (longPressTimer.current !== null) {
            clearTimeout(longPressTimer.current)
            longPressTimer.current = null
        }
    }

    useEffect(() => clearLongPressTimer, [])

    const handlePointerDown: PointerEventHandler<HTMLButtonElement> = (e) => {
        if (disabled) {
            onPointerDown?.(e)
            return
        }

        e.currentTarget.setPointerCapture(e.pointerId)
        setPressed(true)
        if (onLongPress) {
            longPressFired.current = false
            pressOrigin.current = { x: e.clientX, y: e.clientY }
            clearLongPressTimer()
            longPressTimer.current = setTimeout(() => {
                longPressTimer.current = null
                longPressFired.current = true
                setPressed(false)
                onLongPress()
            }, LONG_PRESS_MS)
        }
        onPointerDown?.(e)
    }

    const handlePointerMove: PointerEventHandler<HTMLButtonElement> = (e) => {
        if (longPressTimer.current !== null) {
            const dx = e.clientX - pressOrigin.current.x
            const dy = e.clientY - pressOrigin.current.y
            if (dx * dx + dy * dy > LONG_PRESS_MOVE_TOLERANCE ** 2) {
                clearLongPressTimer()
            }
        }
        onPointerMove?.(e)
    }

    const resetPressed = () => {
        setPressed(false)
        clearLongPressTimer()
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

    const handleClick: MouseEventHandler<HTMLButtonElement> = (e) => {
        if (longPressFired.current) {
            longPressFired.current = false
            e.preventDefault()
            e.stopPropagation()
            return
        }
        onClick?.(e)
    }

    const handleContextMenu: MouseEventHandler<HTMLButtonElement> = (e) => {
        if (onLongPress) e.preventDefault()
        onContextMenu?.(e)
    }

    return (
        <button
            {...props}
            disabled={disabled}
            onClick={handleClick}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerCancel}
            onPointerLeave={handlePointerLeave}
            onContextMenu={handleContextMenu}
            onBlur={handleBlur}
            style={{
                ...baseStyle,
                ...(onLongPress ? { WebkitTouchCallout: 'none' } : undefined),
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
