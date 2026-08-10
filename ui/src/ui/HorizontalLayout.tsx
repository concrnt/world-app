import type { CSSProperties, ReactNode } from 'react'

interface Props {
    children: ReactNode
    style?: CSSProperties
}

// 横スクロールコンテナ。実際にあふれている時はpointerdownを親に流さず、
// サイドバーを開くドラッグやスワイプバック(drag="x")との干渉を防ぐ。
export const HorizontalLayout = (props: Props) => {
    return (
        <div
            style={{
                display: 'flex',
                overflowX: 'auto',
                ...props.style
            }}
            onPointerDownCapture={(e) => {
                if (e.currentTarget.scrollWidth > e.currentTarget.clientWidth) e.stopPropagation()
            }}
        >
            {props.children}
        </div>
    )
}
