import type { CSSProperties, ReactNode } from 'react'
import { CssVar } from '../types/Theme'
import { Text } from './Text'

type Variant = 'info' | 'success' | 'warning' | 'error'

interface Props {
    children: ReactNode
    variant?: Variant
    /** 見出し行のラベル。省略するとアイコンと本文を1行に並べる */
    title?: ReactNode
    /** variant 既定のアイコンを差し替える */
    icon?: ReactNode
    style?: CSSProperties
}

const colors: Record<Variant, string> = {
    info: '#2196f3',
    success: '#4caf50',
    warning: '#ff9800',
    error: '#ff5b5b'
}

const iconProps = {
    width: 18,
    height: 18,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2,
    strokeLinecap: 'round',
    strokeLinejoin: 'round'
} as const

const icons: Record<Variant, ReactNode> = {
    info: (
        <svg {...iconProps}>
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="16" x2="12" y2="12" />
            <line x1="12" y1="8" x2="12.01" y2="8" />
        </svg>
    ),
    success: (
        <svg {...iconProps}>
            <circle cx="12" cy="12" r="10" />
            <polyline points="8 12 11 15 16 9" />
        </svg>
    ),
    warning: (
        <svg {...iconProps}>
            <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
    ),
    error: (
        <svg {...iconProps}>
            <circle cx="12" cy="12" r="10" />
            <line x1="15" y1="9" x2="9" y2="15" />
            <line x1="9" y1="9" x2="15" y2="15" />
        </svg>
    )
}

export const Hint = ({ children, variant = 'info', title, icon, style }: Props) => {
    const color = colors[variant]
    const iconNode = (
        <div style={{ display: 'flex', alignItems: 'center', flexShrink: 0, color }}>{icon ?? icons[variant]}</div>
    )
    return (
        <div
            role={variant === 'error' ? 'alert' : 'note'}
            style={{
                display: 'flex',
                flexDirection: title ? 'column' : 'row',
                alignItems: title ? 'stretch' : 'flex-start',
                gap: CssVar.space(1),
                border: `1px solid rgb(from ${color} r g b / 0.4)`,
                borderRadius: CssVar.round(2),
                padding: CssVar.space(2),
                backgroundColor: `rgb(from ${color} r g b / 0.1)`,
                color: CssVar.contentText,
                ...style
            }}
        >
            {title ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: CssVar.space(1) }}>
                    {iconNode}
                    <Text variant="caption" style={{ fontWeight: 'bold', color }}>
                        {title}
                    </Text>
                </div>
            ) : (
                iconNode
            )}
            <Text style={{ flex: 1 }}>{children}</Text>
        </div>
    )
}
