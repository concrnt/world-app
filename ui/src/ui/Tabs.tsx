import { CSSProperties, ReactNode } from 'react'
import { useTheme } from '../contexts/Theme'
import { CssVar } from '../types/Theme'

interface Props {
    children: ReactNode
    style?: CSSProperties
}

export const Tabs = (props: Props) => {
    const theme = useTheme()

    return (
        <div
            style={{
                display: 'flex',
                justifyContent: 'space-around',
                backgroundColor: theme.variant === 'classic' ? CssVar.backdropBackground : 'transparent',
                ...props.style
            }}
        >
            {props.children}
        </div>
    )
}
