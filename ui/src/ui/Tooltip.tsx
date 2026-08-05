import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { CssVar } from '../types/Theme'
import { useAnchor } from './Popover'

interface Props {
    content: ReactNode // tooltipの中身(uiはworldlibに依存できないため呼び出し側が組む)
    children: ReactNode // トリガー
    onOpen?: () => void // 開いた瞬間に発火(遅延フェッチ用)
    enterDelay?: number // default 300ms
    style?: CSSProperties // tooltip面の上書き
}

// hover表示専用のtooltip。Popoverと同じくCSS Anchor Positioning + ネイティブpopoverで実装するが、
// popover="auto"は排他制御で開いている他のauto popover(Selectメニュー等)を閉じてしまうため
// "manual"にして開閉を自前のhover stateで制御する("hint"はChrome 133+限定なので使わない)。
// tooltip面はpointerEvents: noneなので中身にインタラクティブな要素は置けない
export const Tooltip = (props: Props) => {
    const anchor = useAnchor()
    const ref = useRef<HTMLDivElement>(null)
    const timer = useRef<number | undefined>(undefined)
    const [open, setOpen] = useState(false)

    useEffect(() => {
        const el = ref.current
        if (!el) return
        if (open) {
            if (!el.matches(':popover-open')) el.showPopover()
        } else {
            if (el.matches(':popover-open')) el.hidePopover()
        }
    }, [open])

    useEffect(() => {
        return () => window.clearTimeout(timer.current)
    }, [])

    return (
        <span
            style={{ display: 'inline-flex', anchorName: anchor } as CSSProperties}
            onMouseEnter={() => {
                // タッチ環境ではタップのたびにチラつくので出さない
                if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return
                window.clearTimeout(timer.current)
                timer.current = window.setTimeout(() => {
                    setOpen(true)
                    props.onOpen?.()
                }, props.enterDelay ?? 300)
            }}
            onMouseLeave={() => {
                window.clearTimeout(timer.current)
                setOpen(false)
            }}
        >
            {props.children}
            <div
                ref={ref}
                popover="manual"
                style={
                    {
                        position: 'fixed',
                        positionAnchor: anchor,
                        inset: 'auto',
                        bottom: `calc(anchor(top) + ${CssVar.space(1)})`,
                        left: 'anchor(left)',
                        positionTryFallbacks: 'flip-block, flip-inline',
                        margin: 0,
                        border: 'none',
                        padding: CssVar.space(1),
                        borderRadius: CssVar.round(1),
                        backgroundColor: CssVar.contentBackground,
                        color: CssVar.contentText,
                        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.2)',
                        pointerEvents: 'none',
                        ...props.style
                    } as CSSProperties
                }
            >
                {props.content}
            </div>
        </span>
    )
}
