import { CSSProperties, ReactNode } from 'react'
import { useTheme } from '../contexts/Theme'
import { useOverlay } from '../contexts/Overlay'
import { createPortal } from 'react-dom'
import { motion } from 'motion/react'

interface Props {
    onClick?: () => void
    children: ReactNode
    style?: CSSProperties
}

export const FAB = (props: Props) => {
    const theme = useTheme()

    const overlay = useOverlay()

    if (!overlay.slot) return null

    return createPortal(
        <motion.button
            onClick={props.onClick}
            style={{
                backgroundColor: theme.ui.background,
                border: 'none',
                color: theme.ui.text,
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
            animate={{ scale: 1 }}
            exit={{ scale: 0 }}
            transition={{ type: 'spring', stiffness: 260, damping: 20 }}
        >
            {props.children}
        </motion.button>,
        overlay.slot
    )
}
