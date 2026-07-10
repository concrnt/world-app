import { useEffect, useId, useRef, type CSSProperties, type ReactNode } from 'react'
import { CssVar } from '../types/Theme'

// トリガー側が style={{ anchorName: useAnchor()の返り値 }} で宣言し、Popoverのanchorに渡すアンカー名を生成する
export const useAnchor = (): string => {
    const id = useId().replace(/[^a-zA-Z0-9-]/g, '')
    return `--anchor-${id}`
}

interface Props {
    open: boolean
    onClose: () => void
    anchor: string // トリガー側が style={{ anchorName: '--xxx' }} で宣言したアンカー名
    children: ReactNode
    style?: CSSProperties
}

export const Popover = (props: Props) => {
    const ref = useRef<HTMLDivElement>(null)

    useEffect(() => {
        const el = ref.current
        if (!el) return
        if (props.open) {
            if (!el.matches(':popover-open')) el.showPopover()
        } else {
            if (el.matches(':popover-open')) el.hidePopover()
        }
    }, [props.open])

    return (
        <div
            ref={ref}
            popover="auto"
            onToggle={(e) => {
                // light dismiss(外側クリック/Esc)で閉じたときに親のstateへ反映する
                if (e.newState === 'closed' && props.open) props.onClose()
            }}
            style={
                {
                    position: 'fixed',
                    positionAnchor: props.anchor,
                    inset: 'auto',
                    top: `calc(anchor(bottom) + ${CssVar.space(1)})`,
                    left: 'anchor(left)',
                    positionTryFallbacks: 'flip-block, flip-inline',
                    margin: 0,
                    border: 'none',
                    padding: CssVar.space(1),
                    borderRadius: CssVar.round(1),
                    backgroundColor: CssVar.contentBackground,
                    color: CssVar.contentText,
                    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.2)',
                    ...props.style
                } as CSSProperties
            }
        >
            {props.children}
        </div>
    )
}
