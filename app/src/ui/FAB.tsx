import { CSSProperties, ReactNode } from 'react'
import { useOverlay } from '../contexts/Overlay'
import { createPortal } from 'react-dom'
import { motion } from 'motion/react'
import { useActivity } from '../contexts/Activity'
import { CssVar } from '../types/Theme'

interface Props {
    onClick?: () => void
    children: ReactNode
    style?: CSSProperties
}

export const FAB = (props: Props) => {
    const overlay = useOverlay()
    const activity = useActivity()

    if (!overlay.slot) return null

    return createPortal(
        activity !== 'hidden' && (
            <motion.button
                onClick={props.onClick}
                style={{
                    backgroundColor: CssVar.uiBackground,
                    border: 'none',
                    color: CssVar.uiText,
                    padding: '15px',
                    borderRadius: '50%',
                    boxShadow: '0 4px 8px rgba(0, 0, 0, 0.2)',
                    width: '60px',
                    height: '60px',
                    fontSize: '24px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    position: 'fixed',
                    bottom: `calc(4rem + env(safe-area-inset-bottom))`,
                    right: '1rem',
                    ...props.style
                }}
                initial={{ scale: 0 }}
                animate={{ scale: 1, transition: { type: 'spring', stiffness: 260, damping: 20 } }}
                exit={{ scale: 0, transition: { type: 'tween', duration: 0.2 } }}
            >
                {props.children}
            </motion.button>
        ),
        overlay.slot
    )
}
