import { CSSProperties, ReactNode } from 'react'
import { useTheme } from '../contexts/Theme'

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
                backgroundColor: theme.ui.background,
                ...props.style
            }}
        >
            {props.children}
        </div>
    )
}
