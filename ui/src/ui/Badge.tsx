import type { CSSProperties } from 'react'

interface Props {
    count: number
    style?: CSSProperties
}

// 未読件数チップ。0以下は描画しない。単体ではインライン配置、Tabは内部でコーナーに絶対配置する
export const Badge = (props: Props) => {
    if (!(props.count > 0)) return null
    return (
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
                backgroundColor: '#ff4444',
                color: '#ffffff',
                fontSize: '10px',
                lineHeight: '16px',
                fontWeight: 700,
                textAlign: 'center',
                pointerEvents: 'none',
                ...props.style
            }}
        >
            {props.count > 99 ? '99+' : props.count}
        </span>
    )
}
