import { createContext } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import { CssVar } from '../types/Theme'
interface Props {
    children: ReactNode
    dense?: boolean
    disablePadding?: boolean
    style?: CSSProperties
}

export const ListDenseContext = createContext(false)

export const List = ({ children, dense = false, disablePadding = false, style }: Props) => {
    return (
        <ListDenseContext.Provider value={dense}>
            <ul
                style={{
                    listStyle: 'none',
                    margin: 0,
                    padding: disablePadding ? 0 : `${CssVar.space(1)} 0`,
                    width: '100%',
                    boxSizing: 'border-box',
                    ...style
                }}
            >
                {children}
            </ul>
        </ListDenseContext.Provider>
    )
}
