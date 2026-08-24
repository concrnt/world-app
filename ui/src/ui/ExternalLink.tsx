import type { CSSProperties, ReactNode } from 'react'
import { useCfmActions } from '../contexts/CfmActions'

interface Props {
    href: string
    style?: CSSProperties
    children?: ReactNode
}

// Anchor for URLs outside the app. When the app layer injects
// CfmActions.openExternal (the Tauri app does, to reach the OS browser),
// it takes over; otherwise this is a plain <a target="_blank">.
export const ExternalLink = (props: Props) => {
    const { openExternal, openInternal } = useCfmActions()
    return (
        <a
            href={props.href}
            target="_blank"
            rel="noopener noreferrer"
            style={props.style}
            onClick={(e) => {
                e.stopPropagation()
                if (openInternal?.(props.href)) {
                    e.preventDefault()
                    return
                }
                if (openExternal) {
                    e.preventDefault()
                    openExternal(props.href)
                }
            }}
        >
            {props.children}
        </a>
    )
}
