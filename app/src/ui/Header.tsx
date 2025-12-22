import { ReactNode } from 'react'
import { useTheme } from '../contexts/Theme'

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
                padding: '4px',
                color: theme.ui.text,
                backgroundColor: theme.ui.background
            }}
        >
            <div
                style={{
                    height: '40px',
                    width: '40px'
                }}
            >
                {props.left}
            </div>
            {props.children}
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
