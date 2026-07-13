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
                fontSize: '0.9rem',
                width: '100%',
                overflow: 'hidden',
                alignItems: 'center',
                justifyContent: 'center',
                ...props.style
            }}
            onClick={(e) => {
                e.stopPropagation()
                props.onClick?.()
            }}
        >
            <div
                style={{
                    width: '40px'
                }}
            >
                {props.left}
            </div>
            <div
                style={{
                    display: 'flex',
                    gap: '4px',
                    flex: 1,
                    overflow: 'hidden',
                    whiteSpace: 'nowrap',
                    alignItems: 'center',
                    justifyContent: 'center'
                }}
            >
                {props.children}
            </div>
        </div>
    )
}
