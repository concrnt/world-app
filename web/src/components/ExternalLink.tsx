import type { CSSProperties, ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { safeHttpUrl } from '@concrnt/worldlib'

interface Props {
    href: string
    style?: CSSProperties
    children?: ReactNode
}

// アプリ外URLへのアンカー。concrnt.worldオリジンの共有URLは新しいタブに出さず内部ルートで開く。
// それ以外は素の<a target="_blank">。
// hrefは投稿本文やリモートの文書など外部入力なので、http(s)以外はリンクにせず文字列だけ出す
export const ExternalLink = (props: Props) => {
    const navigate = useNavigate()
    const href = safeHttpUrl(props.href)
    if (!href) return <span style={props.style}>{props.children}</span>
    return (
        <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            style={props.style}
            onClick={(e) => {
                e.stopPropagation()
                let parsed: URL
                try {
                    parsed = new URL(href)
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
