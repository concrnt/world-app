import type { CSSProperties, ReactNode } from 'react'
import { CssVar } from '../types/Theme'
import { HorizontalLayout } from './HorizontalLayout'

interface Props {
    children: ReactNode
    style?: CSSProperties
    variant?: 'classic' | 'world'
}

export const Tabs = (props: Props) => {
    return (
        <HorizontalLayout
            style={{
                justifyContent: 'space-around',
                backgroundColor: (props.variant ?? 'world') === 'classic' ? CssVar.backdropBackground : 'transparent',
                ...props.style
            }}
        >
            {props.children}
        </HorizontalLayout>
    )
}
