import { ReactNode } from 'react'

interface Props {
    onClick?: () => void
    left: ReactNode
    children?: ReactNode
    style?: React.CSSProperties
}

export const OnelineMessageLayout = (props: Props) => {
    return (
        <div
            style={{
                display: 'flex',
                flexDirection: 'row',
                gap: '8px',
                height: '1.4rem',
                width: '100%',
                overflow: 'hidden',
                ...props.style
            }}
            onClick={(e) => {
                e.stopPropagation()
                props.onClick?.()
            }}
        >
            <div
                style={{
                    width: '48px'
                }}
            >
                {props.left}
            </div>
            <div
                style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px',
                    flex: 1
                }}
            >
                {props.children}
            </div>
        </div>
    )
}
