import type { CSSProperties, ReactNode } from 'react'
interface Props {
    children: ReactNode
    style?: CSSProperties
}

export const List = ({ children, style }: Props) => {
    return (
        <ul
            style={{
                listStyle: 'none',
                margin: 0,
                padding: 0,
                width: '100%',
                boxSizing: 'border-box',
                ...style
            }}
        >
            {children}
        </ul>
    )
}
