import type { CSSProperties } from 'react'

interface Props {
    // 等間隔の系列値。2点未満・全て0のときは何も描かない
    values: number[]
    strokeWidth?: number
    fillOpacity?: number
    style?: CSSProperties
}

// 上端に余白を残して最大値が線幅ごと収まるようにする
const PEAK_HEIGHT = 92

export const Sparkline = (props: Props) => {
    const values = props.values
    const max = Math.max(0, ...values)
    if (values.length < 2 || max <= 0) return null

    const points = values.map((v, i) => {
        const x = (i / (values.length - 1)) * 100
        const y = 100 - (Math.max(0, v) / max) * PEAK_HEIGHT
        return `${x} ${y}`
    })
    const line = `M ${points.join(' L ')}`
    const area = `${line} L 100 100 L 0 100 Z`

    return (
        <svg
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            style={{ width: '100%', height: '100%', display: 'block', ...props.style }}
        >
            <path d={area} fill="currentColor" fillOpacity={props.fillOpacity ?? 0.35} stroke="none" />
            <path
                d={line}
                fill="none"
                stroke="currentColor"
                strokeWidth={props.strokeWidth ?? 1.5}
                strokeLinejoin="round"
                // 非等方スケールで線幅が歪まないようにする
                vectorEffect="non-scaling-stroke"
            />
        </svg>
    )
}
