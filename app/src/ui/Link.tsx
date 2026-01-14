import { ReactNode } from 'react'

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
            onClick={(e) => {
                e.stopPropagation()
            }}
        >
            {props.children}
        </a>
    )
}
