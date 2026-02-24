import { ReactNode } from 'react'
import { useTheme } from '../contexts/Theme'
import { CssVar } from '../types/Theme'

interface Props {
    children?: ReactNode
}

export const View = (props: Props) => {
    const theme = useTheme()

    if (theme.variant === 'classic') {
        return (
            <div
                data-testid="view-classic"
                style={{
                    width: '100%',
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    color: CssVar.contentText,
                    backgroundColor: CssVar.contentBackground
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
                    margin: `env(safe-area-inset-top) ${CssVar.space(1)} ${CssVar.space(1)} ${CssVar.space(1)}`,
                    borderRadius: CssVar.round(1),
                    overflow: 'hidden',
                    flex: 1
                }}
            >
                {props.children}
            </div>
        )
    }
}
