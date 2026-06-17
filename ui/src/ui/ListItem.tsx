import { useContext } from 'react'
import type { CSSProperties, MouseEvent, ReactNode } from 'react'
import { CssVar } from '../types/Theme'
import { ButtonBase } from './ButtonBase'
import { ListDenseContext } from './List'

interface Props {
    children: ReactNode
    startIcon?: ReactNode
    endIcon?: ReactNode
    icon?: ReactNode
    secondaryAction?: ReactNode
    onClick?: (e: MouseEvent<HTMLButtonElement>) => void
    disabled?: boolean
    dense?: boolean
    style?: CSSProperties
}

const baseContainerStyle: CSSProperties = {
    listStyle: 'none',
    margin: 0,
    padding: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%'
}

const baseContentStyle: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: CssVar.space(1),
    width: '100%',
    boxSizing: 'border-box',
    color: 'inherit',
    fontSize: '1rem',
    lineHeight: 1.5
}

const interactiveStyle: CSSProperties = {
    textAlign: 'left',
    cursor: 'pointer'
}

const pressedStyle: CSSProperties = {
    backgroundColor: `rgb(from ${CssVar.uiBackground} r g b / 0.16)`,
    filter: 'brightness(0.9)'
}
export const ListItem = ({
    children,
    startIcon: startIconProp,
    endIcon,
    icon,
    secondaryAction,
    onClick,
    disabled = false,
    dense,
    style
}: Props) => {
    const listDense = useContext(ListDenseContext)
    const isDense = dense ?? listDense
    const startIcon = startIconProp ?? icon
    const contentStyle: CSSProperties = {
        ...baseContentStyle,
        minHeight: isDense ? 40 : 48,
        padding: isDense ? `${CssVar.space(0.5)} ${CssVar.space(2)}` : `${CssVar.space(1)} ${CssVar.space(2)}`,
        paddingRight: secondaryAction ? CssVar.space(1) : CssVar.space(2)
    }

    const content = (
        <>
            {startIcon ? (
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
                    {startIcon}
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
            {endIcon ? (
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
                    {endIcon}
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
                        ...contentStyle,
                        ...interactiveStyle
                    }}
                >
                    {content}
                </ButtonBase>
            ) : (
                <div style={contentStyle}>{content}</div>
            )}
            {secondaryAction ? (
                <div
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        flexShrink: 0,
                        paddingRight: CssVar.space(2)
                    }}
                >
                    {secondaryAction}
                </div>
            ) : null}
        </li>
    )
}
