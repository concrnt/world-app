import { CSSProperties, ReactNode } from 'react'
import { useTheme } from '../contexts/Theme'
import { useOverlay } from '../contexts/Overlay'
import { createPortal } from 'react-dom'
import { motion } from 'motion/react'
import { useActivity } from '../contexts/Activity'

interface Props {
    onClick?: () => void
    children: ReactNode
    style?: CSSProperties
}

export const FAB = (props: Props) => {
    const theme = useTheme()

    const overlay = useOverlay()
    const activity = useActivity()

    if (!overlay.slot) return null

    return createPortal(
        activity !== 'hidden' && (
            <motion.button
                onClick={props.onClick}
                style={{
                    backgroundColor: theme.ui.background,
                    border: 'none',
                    color: theme.ui.text,
                    padding: 'var(--fab-padding)',
                    borderRadius: '50%',
                    boxShadow: '0 4px 8px rgba(0, 0, 0, 0.2)',
                    width: 'var(--control-fab)',
                    height: 'var(--control-fab)',
                    fontSize: '1.5em',
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
