import { type CSSProperties } from 'react'
import { motion } from 'motion/react'
import { CssVar } from '../types/Theme'

const TRACK_WIDTH = 51
const TRACK_HEIGHT = 31
const THUMB_SIZE = 27
const THUMB_OFFSET = 2

interface Props {
    checked: boolean
    onChange: (value: boolean) => void
    disabled?: boolean
}

export const Switch = ({ checked, onChange, disabled = false }: Props) => {
    const thumbX = checked ? TRACK_WIDTH - THUMB_SIZE - THUMB_OFFSET : THUMB_OFFSET

    const trackStyle: CSSProperties = {
        position: 'relative',
        width: `${TRACK_WIDTH}px`,
        height: `${TRACK_HEIGHT}px`,
        borderRadius: CssVar.round(8),
        backgroundColor: checked ? CssVar.uiBackground : CssVar.divider,
        cursor: disabled ? 'default' : 'pointer',
        border: 'none',
        padding: 0,
        transition: 'background-color 0.2s ease',
        opacity: disabled ? 0.45 : 1,
        WebkitTapHighlightColor: 'transparent',
        flexShrink: 0
    }

    return (
        <button
            role="switch"
            aria-checked={checked}
            disabled={disabled}
            onClick={() => onChange(!checked)}
            style={trackStyle}
        >
            <motion.div
                animate={{ x: thumbX }}
                initial={false}
                transition={{ type: 'spring', stiffness: 500, damping: 40 }}
                style={{
                    position: 'absolute',
                    top: `${THUMB_OFFSET}px`,
                    left: 0,
                    width: `${THUMB_SIZE}px`,
                    height: `${THUMB_SIZE}px`,
                    borderRadius: CssVar.round(8),
                    backgroundColor: 'white',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.3)'
                }}
            />
        </button>
    )
}
