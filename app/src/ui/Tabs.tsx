import { ReactNode } from 'react'
import { useTheme } from '../contexts/Theme'

interface Props {
    children: ReactNode
}

export const Tabs = (props: Props) => {
    const theme = useTheme()

    return (
        <div
            style={{
                display: 'flex',
                justifyContent: 'space-around',
                height: '3rem',
                backgroundColor: theme.ui.background
            }}
        >
            {props.children}
        </div>
    )
}
