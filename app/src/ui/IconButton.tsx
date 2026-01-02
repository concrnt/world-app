import { ReactNode } from 'react'

interface Props {
    onClick?: () => void
    children: ReactNode
    disabled?: boolean
}

export const IconButton = (props: Props) => {
    return (
        <button
            disabled={props.disabled}
            onClick={props.onClick}
            style={{
                padding: '15px 32px',
                textAlign: 'center',
                fontSize: '16px',
                margin: '4px'
            }}
        >
            {props.children}
        </button>
    )
}
