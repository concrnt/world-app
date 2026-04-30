import type { CSSProperties, MouseEvent, ReactNode } from 'react'
import { CssVar } from '../types/Theme'
import { ButtonBase } from './ButtonBase'

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
    textAlign: 'left',
    cursor: 'pointer'
}

const pressedStyle: CSSProperties = {
    backgroundColor: `rgb(from ${CssVar.uiBackground} r g b / 0.16)`,
    filter: 'brightness(0.9)'
}
export const ListItem = ({ children, icon, secondaryAction, onClick, disabled = false, style }: Props) => {
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
                <ButtonBase
                    disabled={disabled}
                    onClick={onClick}
                    pressedStyle={pressedStyle}
                    style={{
                        ...baseContentStyle,
                        ...interactiveStyle
                    }}
                >
                    {content}
                </ButtonBase>
            ) : (
                <div style={baseContentStyle}>{content}</div>
            )}
        </li>
    )
}
