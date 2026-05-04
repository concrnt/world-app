import type { ReactNode } from 'react'
import { CssVar, useTheme } from '@concrnt/ui'

interface Props {
    children?: ReactNode
    left?: ReactNode
    right?: ReactNode
}

export const Header = (props: Props) => {
    const theme = useTheme()

    return (
        <div
            style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: CssVar.space(2),
                padding: CssVar.space(2),
                color: theme.variant === 'classic' ? CssVar.backdropText : CssVar.uiText,
                backgroundColor: theme.variant === 'classic' ? CssVar.backdropBackground : CssVar.uiBackground,
                borderBottom: `1px solid ${CssVar.divider}`,
                flexShrink: 0
            }}
        >
            <div
                style={{
                    minWidth: 40,
                    minHeight: 40,
                    display: 'flex',
                    alignItems: 'center'
                }}
            >
                {props.left}
            </div>
            <div
                style={{
                    flex: 1,
                    textAlign: 'center',
                    fontWeight: 700
                }}
            >
                {props.children}
            </div>
            <div
                style={{
                    minWidth: 40,
                    minHeight: 40,
                    display: 'flex',
                    justifyContent: 'flex-end',
                    alignItems: 'center'
                }}
            >
                {props.right}
            </div>
        </div>
    )
}
