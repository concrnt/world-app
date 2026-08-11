import type { ReactNode } from 'react'
import { CssVar } from '../types/Theme'
import { ExternalLink } from './ExternalLink'

interface Props {
    href: string
    children?: ReactNode
}

export const Link = (props: Props) => {
    return (
        <ExternalLink
            href={props.href}
            style={{
                color: CssVar.contentLink
            }}
        >
            {props.children}
        </ExternalLink>
    )
}
