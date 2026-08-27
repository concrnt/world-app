import type { CSSProperties } from 'react'
import styles from './CircularProgress.module.css'

interface Props {
    // 0〜1の進捗。未指定なら回転し続けるindeterminate表示になる
    value?: number
    size?: number
    style?: CSSProperties
}

const RADIUS = 16
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

export const CircularProgress = (props: Props) => {
    const size = props.size ?? 40
    const indeterminate = props.value === undefined
    const value = Math.max(0, Math.min(1, props.value ?? 0))

    return (
        <svg
            viewBox="0 0 40 40"
            width={size}
            height={size}
            style={{
                // determinateは12時の位置から時計回りに進める
                transform: indeterminate ? undefined : 'rotate(-90deg)',
                animation: indeterminate ? `${styles.rotate} 1.4s linear infinite` : undefined,
                ...props.style
            }}
        >
            <circle
                cx={20}
                cy={20}
                r={RADIUS}
                fill="none"
                stroke="currentColor"
                strokeWidth={4}
                strokeDasharray={
                    indeterminate
                        ? `${CIRCUMFERENCE * 0.25} ${CIRCUMFERENCE}`
                        : `${CIRCUMFERENCE * value} ${CIRCUMFERENCE}`
                }
                style={indeterminate ? undefined : { transition: 'stroke-dasharray 0.2s linear' }}
            />
        </svg>
    )
}
