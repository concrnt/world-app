import type { CSSProperties, ReactNode } from 'react'
import { CssVar } from '../types/Theme'

interface Props {
    children: ReactNode
    style?: CSSProperties
    variant?: 'classic' | 'world'
}

export const Tabs = (props: Props) => {
    return (
        <div
            style={{
                display: 'flex',
                justifyContent: 'space-around',
                backgroundColor: (props.variant ?? 'world') === 'classic' ? CssVar.backdropBackground : 'transparent',
                ...props.style
            }}
        >
            {props.children}
        </div>
    )
}
