import { ReactNode } from 'react'
import { useTheme } from '../contexts/Theme'
import { useNavigation } from '../contexts/Navigation'
import { CssVar } from '../types/Theme'

interface Props {
    children?: ReactNode
    leftOverride?: ReactNode
    right?: ReactNode
}

export const Header = (props: Props) => {
    const theme = useTheme()

    const nav = useNavigation()

    return (
        <div
            style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: CssVar.space(1),
                color: theme.variant === 'classic' ? CssVar.backdropText : CssVar.uiText,
                backgroundColor: theme.variant === 'classic' ? CssVar.backdropBackground : CssVar.uiBackground,
                paddingTop: theme.variant === 'classic' ? 'env(safe-area-inset-top)' : CssVar.space(1),
                borderBottom: `1px solid ${CssVar.divider}`
            }}
        >
            <div
                style={{
                    height: '40px',
                    width: '40px'
                }}
            >
                {props.leftOverride ?? nav.backNode}
            </div>
            <div
                style={{
                    flexGrow: 1,
                    textAlign: 'center',
                    fontWeight: 'bold'
                }}
            >
                {props.children}
            </div>
            <div
                style={{
                    height: '40px',
                    width: '40px'
                }}
            >
                {props.right}
            </div>
        </div>
    )
}
