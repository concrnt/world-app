import { useState } from 'react'
import type { CSSProperties, MouseEvent, ReactNode } from 'react'
import { CssVar } from '../types/Theme'
import { ButtonBase } from './ButtonBase'

interface Props {
    onClick?: (e: MouseEvent<HTMLButtonElement>) => void | Promise<void>
    children: ReactNode
    busyChildren?: ReactNode
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
    cursor: 'pointer'
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
export const Button = ({
    onClick,
    children,
    busyChildren,
    variant = 'contained',
    disabled = false,
    startIcon,
    endIcon,
    style
}: Props) => {
    const [busy, setBusy] = useState(false)

    const handleClick = (e: MouseEvent<HTMLButtonElement>) => {
        const result = onClick?.(e)
        if (result instanceof Promise) {
            setBusy(true)
            result.finally(() => setBusy(false))
        }
    }

    const pressedStyle: CSSProperties =
        variant === 'text'
            ? {
                  backgroundColor: `rgb(from ${CssVar.contentLink} r g b / 0.12)`
              }
            : {
                  filter: 'brightness(0.75)'
              }

    return (
        <ButtonBase
            disabled={disabled || busy}
            onClick={handleClick}
            pressedStyle={pressedStyle}
            style={{
                ...baseStyle,
                ...variantStyles[variant],
                ...style
            }}
        >
            {busy && busyChildren ? (
                busyChildren
            ) : (
                <>
                    {startIcon}
                    {children}
                    {endIcon}
                </>
            )}
        </ButtonBase>
    )
}
