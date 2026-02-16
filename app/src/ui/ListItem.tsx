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
                gap: 'var(--space-2)'
            }}
        >
            <div
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: 'var(--control-icon)',
                    height: 'var(--control-icon)',
                    fontSize: 'var(--control-icon)'
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
