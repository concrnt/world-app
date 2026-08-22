import type { CSSProperties, ReactNode } from 'react'
import { CssVar } from '../types/Theme'

export interface BadgeAnchorOrigin {
    vertical: 'top' | 'bottom'
    horizontal: 'left' | 'right'
}

interface Props {
    count: number
    // 指定するとchildrenを包み、そのコーナーにチップを重ねる。省略時はチップ単体をインライン描画
    children?: ReactNode
    // childrenに対するチップの位置。既定は右上
    anchorOrigin?: BadgeAnchorOrigin
    // チップ自体のstyle(色の上書きなど)。色はuiカラーがデフォルトで、backdrop上に置く場合は利用側で上書きする
    style?: CSSProperties
}

// 未読件数チップ。0以下はチップを描画しない(childrenはそのまま描画する)
export const Badge = (props: Props) => {
    const origin = props.anchorOrigin ?? { vertical: 'top', horizontal: 'right' }
    const chip = props.count > 0 && (
        <span
            role="status"
            aria-label={`${props.count}`}
            style={{
                display: 'inline-block',
                minWidth: '16px',
                height: '16px',
                padding: '0 4px',
                boxSizing: 'border-box',
                borderRadius: '8px',
                backgroundColor: CssVar.uiBackground,
                color: CssVar.uiText,
                fontSize: '10px',
                lineHeight: '16px',
                fontWeight: 700,
                textAlign: 'center',
                pointerEvents: 'none',
                ...(props.children !== undefined && {
                    position: 'absolute',
                    [origin.vertical]: 0,
                    [origin.horizontal]: 0,
                    transform: `translate(${origin.horizontal === 'right' ? '40%' : '-40%'}, ${
                        origin.vertical === 'top' ? '-30%' : '30%'
                    })`
                }),
                ...props.style
            }}
        >
            {props.count > 99 ? '99+' : props.count}
        </span>
    )

    if (props.children === undefined) return chip || null

    return (
        <span style={{ position: 'relative', display: 'inline-flex' }}>
            {props.children}
            {chip}
        </span>
    )
}
