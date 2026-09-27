import type { CSSProperties } from 'react'
import styles from './Skeleton.module.css'
import { CssVar } from '../types/Theme'

interface Props {
    width?: string | number
    height?: string | number
    style?: CSSProperties
}

export const Skeleton = (props: Props) => {
    return (
        <div
            style={{
                position: 'relative',
                width: props.width ?? '100%',
                height: props.height ?? '100%',
                overflow: 'hidden',
                background: `rgb(from ${CssVar.contentText} r g b / 0.1)`,
                ...props.style
            }}
        >
            <div
                style={{
                    position: 'absolute',
                    inset: 0,
                    transform: 'translateX(-100%)',
                    background: `linear-gradient(90deg, transparent 0%, rgb(from ${CssVar.contentText} r g b / 0.08) 50%, transparent 100%)`,
                    animation: `${styles.shimmer} 1.6s linear infinite`
                }}
            />
        </div>
    )
}
