import { useState } from 'react'
import type { CSSProperties, MouseEvent, PointerEvent, ReactNode } from 'react'
import { CssVar } from '../types/Theme'

interface Props {
    children: ReactNode
    icon?: ReactNode
    secondaryAction?: ReactNode
    onClick?: (e: MouseEvent<HTMLButtonElement>) => void
    disabled?: boolean
    style?: CSSProperties
}

const baseContainerStyle: CSSProperties = {
    listStyle: 'none',
    margin: 0,
    padding: 0
}

const baseContentStyle: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: CssVar.space(1),
    width: '100%',
    padding: `${CssVar.space(1)} ${CssVar.space(2)}`,
    boxSizing: 'border-box',
    color: 'inherit',
    fontSize: 'inherit'
}

const interactiveStyle: CSSProperties = {
    backgroundColor: 'transparent',
    border: 'none',
    textAlign: 'left',
    cursor: 'pointer',
    touchAction: 'manipulation',
    WebkitTapHighlightColor: 'transparent',
    userSelect: 'none'
}

const pressedStyle: CSSProperties = {
    backgroundColor: `rgb(from ${CssVar.uiBackground} r g b / 0.16)`,
    filter: 'brightness(0.9)'
}

const disabledStyle: CSSProperties = {
    opacity: 0.45,
    pointerEvents: 'none'
}

export const ListItem = ({ children, icon, secondaryAction, onClick, disabled = false, style }: Props) => {
    const [pressed, setPressed] = useState(false)

    const handlePointerDown = (e: PointerEvent<HTMLButtonElement>) => {
        if (disabled) return

        e.currentTarget.setPointerCapture(e.pointerId)
        setPressed(true)
    }

    const resetPressed = () => {
        setPressed(false)
    }

    const content = (
        <>
            {icon ? (
                <div
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: '24px',
                        height: '24px',
                        flexShrink: 0
                    }}
                >
                    {icon}
                </div>
            ) : null}
            <div
                style={{
                    flex: 1,
                    minWidth: 0
                }}
            >
                {children}
            </div>
            {secondaryAction ? (
                <div
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        flexShrink: 0
                    }}
                >
                    {secondaryAction}
                </div>
            ) : null}
        </>
    )

    return (
        <li style={{ ...baseContainerStyle, ...style }}>
            {onClick ? (
                <button
                    disabled={disabled}
                    onClick={onClick}
                    onPointerDown={handlePointerDown}
                    onPointerUp={resetPressed}
                    onPointerCancel={resetPressed}
                    onPointerLeave={resetPressed}
                    onBlur={resetPressed}
                    style={{
                        ...baseContentStyle,
                        ...interactiveStyle,
                        ...(pressed && !disabled ? pressedStyle : undefined),
                        ...(disabled ? disabledStyle : undefined)
                    }}
                >
                    {content}
                </button>
            ) : (
                <div style={baseContentStyle}>{content}</div>
            )}
        </li>
    )
}
