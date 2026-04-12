import type { ReactNode } from 'react'
import { CssVar } from '../types/Theme'
import { useTheme } from '../contexts'

interface Props {
    children?: ReactNode
    variant?: 'classic' | 'world'
    style?: React.CSSProperties
}

export const View = (props: Props) => {
    const theme = useTheme()
    const variant = props.variant ?? theme.variant

    if (variant === 'classic') {
        return (
            <div
                data-testid="view-classic"
                style={{
                    width: '100%',
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    color: CssVar.contentText,
                    backgroundColor: CssVar.contentBackground,
                    ...props.style
                }}
            >
                {props.children}
            </div>
        )
    } else {
        return (
            <div
                data-testid="view-world"
                style={{
                    display: 'flex',
                    flexDirection: 'column',
                    color: CssVar.contentText,
                    backgroundColor: CssVar.contentBackground,
                    borderRadius: CssVar.round(1),
                    overflow: 'hidden',
                    margin: `env(safe-area-inset-top) ${CssVar.space(1)} ${CssVar.space(1)} ${CssVar.space(1)}`,
                    flex: 1,
                    ...props.style
                }}
            >
                {props.children}
            </div>
        )
    }
}
