import type { CSSProperties, ReactNode } from 'react'
import { CssVar } from '../types/Theme'
import { ButtonBase } from './ButtonBase'

interface Props {
    onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void
    children: ReactNode
    disabled?: boolean
    style?: CSSProperties
    variant?: 'transparent' | 'contained'
}

export const IconButton = (props: Props) => {
    const pressedStyle: CSSProperties =
        props.variant === 'contained'
            ? {
                  filter: 'brightness(0.85)'
              }
            : {
                  backgroundColor: `rgb(from ${CssVar.contentText} r g b / 0.12)`
              }

    const transparentStyle: CSSProperties = {
        backgroundColor: `rgb(from ${CssVar.contentText} r g b / 0)`,
        padding: '8px',
        fontSize: '16px',
        margin: '4px',
        color: CssVar.contentText,
        borderRadius: '999px',
        width: '32px',
        height: '32px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        boxSizing: 'border-box'
    }

    switch (props.variant) {
        default:
        case 'transparent':
            return (
                <ButtonBase
                    disabled={props.disabled}
                    onClick={props.onClick}
                    pressedStyle={pressedStyle}
                    style={{
                        ...transparentStyle,
                        ...props.style
                    }}
                >
                    {props.children}
                </ButtonBase>
            )
        case 'contained':
            return (
                <ButtonBase
                    disabled={props.disabled}
                    onClick={props.onClick}
                    pressedStyle={pressedStyle}
                    style={{
                        backgroundColor: `rgb(from ${CssVar.uiBackground} r g b / 0.8)`,
                        color: CssVar.uiText,
                        borderRadius: '100%',
                        padding: '8px',
                        fontSize: '16px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        ...props.style
                    }}
                >
                    {props.children}
                </ButtonBase>
            )
    }
}
