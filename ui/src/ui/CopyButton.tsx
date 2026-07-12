import { useEffect, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { CssVar } from '../types/Theme'
import { IconButton } from './IconButton'

interface Props {
    text: string
    size?: number
    style?: CSSProperties
}

const CopyIcon = ({ size }: { size: number }) => (
    <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
    >
        <rect x="9" y="9" width="12" height="12" rx="2" />
        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
)

const CheckIcon = ({ size }: { size: number }) => (
    <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
    >
        <polyline points="20 6 9 17 4 12" />
    </svg>
)

export const CopyButton = ({ text, size = 16, style }: Props) => {
    const [copied, setCopied] = useState(false)
    const timerRef = useRef<number | null>(null)

    useEffect(() => {
        return () => {
            if (timerRef.current !== null) window.clearTimeout(timerRef.current)
        }
    }, [])

    return (
        <div style={{ position: 'relative', display: 'inline-flex', ...style }}>
            {copied && (
                <div
                    style={{
                        position: 'absolute',
                        bottom: '100%',
                        left: '50%',
                        transform: 'translateX(-50%)',
                        marginBottom: '4px',
                        padding: '2px 8px',
                        borderRadius: '4px',
                        backgroundColor: CssVar.uiBackground,
                        color: CssVar.uiText,
                        fontSize: '12px',
                        whiteSpace: 'nowrap',
                        pointerEvents: 'none'
                    }}
                >
                    Copied!
                </div>
            )}
            <IconButton
                onClick={() => {
                    navigator.clipboard.writeText(text).then(() => {
                        setCopied(true)
                        if (timerRef.current !== null) window.clearTimeout(timerRef.current)
                        timerRef.current = window.setTimeout(() => {
                            setCopied(false)
                        }, 2000)
                    })
                }}
            >
                {copied ? <CheckIcon size={size} /> : <CopyIcon size={size} />}
            </IconButton>
        </div>
    )
}
