import type { CSSProperties, ReactNode } from 'react'
import { openUrl } from '@tauri-apps/plugin-opener'
import { safeHttpUrl } from '@concrnt/worldlib'
import { useStack } from '../layouts/Stack'
import { PostView } from '../views/Post'
import { TimelineView } from '../views/Timeline'
import { ProfileView } from '../views/Profile'
import { ApView } from '../views/ApView'
import { BskyView } from '../views/BskyView'

interface Props {
    href: string
    style?: CSSProperties
    children?: ReactNode
}

// アプリ外URLへのアンカー。concrnt.worldオリジンの共有URLは外部ブラウザに出さず、
// 対応するビューを最寄りのスタックに積む(StackLayout外ではpushは既定のno-op)。
// それ以外はOSの既定ブラウザで開く(openUrlの第2引数なし = inAppBrowserではない)。
// ビューの参照はクリック時に行う: モジュール先頭で参照すると循環importで未初期化になる。
// hrefは投稿本文やリモートの文書など外部入力なので、http(s)以外はリンクにせず文字列だけ出す
export const ExternalLink = (props: Props) => {
    const { push } = useStack()
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
                e.preventDefault()
                let parsed: URL | null = null
                try {
                    parsed = new URL(href)
                } catch {
                    parsed = null
                }
                if (parsed && parsed.hostname === 'concrnt.world') {
                    const path = parsed.pathname
                    let match: RegExpMatchArray | null
                    if ((match = path.match(/^\/post\/([^/]+)$/))) {
                        push(<PostView uri={decodeURIComponent(match[1])} />)
                        return
                    } else if ((match = path.match(/^\/timeline\/([^/]+)$/))) {
                        push(<TimelineView uri={decodeURIComponent(match[1])} />)
                        return
                    } else if ((match = path.match(/^\/profile\/([^/]+)(?:\/([^/]+))?$/))) {
                        push(
                            <ProfileView
                                ccid={decodeURIComponent(match[1])}
                                profileName={match[2] ? decodeURIComponent(match[2]) : undefined}
                            />
                        )
                        return
                    } else if ((match = path.match(/^\/activitypub\/(?:person|note|view)\/([^/]+)$/))) {
                        push(<ApView uri={decodeURIComponent(match[1])} />)
                        return
                    } else if ((match = path.match(/^\/bluesky\/(?:person|post|view)\/([^/]+)$/))) {
                        push(<BskyView uri={decodeURIComponent(match[1])} />)
                        return
                    }
                }
                openUrl(href)
            }}
        >
            {props.children}
        </a>
    )
}
