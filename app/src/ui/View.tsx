import { ReactNode } from 'react'
import { useTheme } from '../contexts/Theme'

interface Props {
    children?: ReactNode
}

export const View = (props: Props) => {
    const theme = useTheme()

    return (
        <div
            style={{
                width: '100%',
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                color: theme.content.text,
                backgroundColor: theme.content.background
            }}
        >
            {props.children}
        </div>
    )
}
