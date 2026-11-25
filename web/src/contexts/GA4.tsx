import { useEffect, type ReactNode } from 'react'
import { useLocation } from 'react-router-dom'

declare global {
    interface Window {
        gtag?: (...args: unknown[]) => void
    }
}

interface GA4ProviderProps {
    tag: string
    children: ReactNode
}

// gtag.js本体はindex.htmlで読み込み済み(send_page_view: false)。
// SPAではルート変更でページが再読み込みされないため、location変化のたびにpage_viewを送る
export const GA4Provider = ({ tag, children }: GA4ProviderProps): ReactNode => {
    const location = useLocation()

    useEffect(() => {
        // タイムライン名やユーザー名のタイトルはデータの取得後に決まるので、それを待ってから読む。
        // 待っている間に離れたページは見たうちに入れないので、遷移で取り消されて送られなくてよい
        const timer = setTimeout(() => {
            if (typeof window.gtag !== 'function') return
            window.gtag('config', tag, {
                page_path: location.pathname + location.hash,
                page_title: document.title
            })
        }, 3000)
        return () => clearTimeout(timer)
    }, [tag, location.pathname, location.hash])

    return children
}
