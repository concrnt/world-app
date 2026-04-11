import { ReactNode } from 'react'

interface Props {
    onClick?: () => void
    left: ReactNode
    headerLeft: ReactNode
    headerRight?: ReactNode
    children?: ReactNode
}

export const MessageLayout = (props: Props) => {
    return (
        <div
            style={{
                display: 'flex',
                flexDirection: 'row',
                gap: '8px'
            }}
            onClick={(e) => {
                e.stopPropagation()
                props.onClick?.()
            }}
        >
            {props.left}
            <div
                style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px',
                    flex: 1
                }}
            >
                <div
                    style={{
                        display: 'flex',
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '8px'
                    }}
                >
                    {props.headerLeft}
                    {props.headerRight}
                </div>
                {props.children}
            </div>
        </div>
    )
}
