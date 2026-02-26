import type { ReactNode } from 'react'
import { CssVar } from '../types/Theme'

interface Props {
    href: string
    children?: ReactNode
}

export const Link = (props: Props) => {
    return (
        <a
            href={props.href}
            target="_blank"
            rel="noopener noreferrer"
            style={{
                color: CssVar.contentLink
            }}
            onClick={(e) => {
                e.stopPropagation()
            }}
        >
            {props.children}
        </a>
    )
}
