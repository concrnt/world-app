import { ReactNode } from 'react'
import { useTheme } from '../contexts/Theme'

interface Props {
    selected?: boolean
    children: ReactNode
    onClick?: () => void
}

export const Tab = (props: Props) => {
    const theme = useTheme()

    return (
        <div
            style={{
                cursor: 'pointer',
                padding: '0.5rem',
                color: theme.ui.text,
                borderBottom: props.selected ? `2px solid ${theme.ui.text}` : '2px solid transparent'
            }}
            onClick={props.onClick}
        >
            {props.children}
        </div>
    )
}
