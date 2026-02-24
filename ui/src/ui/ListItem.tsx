import { ReactNode } from 'react'

interface Props {
    icon: ReactNode
    children: ReactNode
    onClick?: () => void
}

export const ListItem = (props: Props) => {
    return (
        <div
            onClick={props.onClick}
            style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
            }}
        >
            <div
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '24px',
                    height: '24px'
                }}
            >
                {props.icon}
            </div>
            <div
                style={{
                    flex: 1
                }}
            >
                {props.children}
            </div>
        </div>
    )
}
