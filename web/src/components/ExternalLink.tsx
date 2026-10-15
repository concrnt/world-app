import type { CSSProperties, ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'

interface Props {
    href: string
    style?: CSSProperties
    children?: ReactNode
}

// アプリ外URLへのアンカー。concrnt.worldオリジンの共有URLは新しいタブに出さず内部ルートで開く。
// それ以外は素の<a target="_blank">
export const ExternalLink = (props: Props) => {
    const navigate = useNavigate()
    return (
        <a
            href={props.href}
            target="_blank"
            rel="noopener noreferrer"
            style={props.style}
            onClick={(e) => {
                e.stopPropagation()
                let parsed: URL
                try {
                    parsed = new URL(props.href)
                } catch {
                    return
                }
                if (parsed.hostname !== 'concrnt.world') return
                const path = parsed.pathname
                const isInternal =
                    /^\/(post|timeline)\/[^/]+$/.test(path) ||
                    /^\/profile\/[^/]+(\/[^/]+)?$/.test(path) ||
                    /^\/activitypub\/(person|note|view)\/[^/]+$/.test(path) ||
                    /^\/bluesky\/(person|post|view)\/[^/]+$/.test(path)
                if (!isInternal) return
                e.preventDefault()
                navigate(path + parsed.search + parsed.hash)
            }}
        >
            {props.children}
        </a>
    )
}
