import { CSSProperties, ReactNode, useState, PointerEvent } from 'react'
import { createPortal } from 'react-dom'
import { motion } from 'motion/react'
import { CssVar } from '../types/Theme'
import { useIsMobile } from '../hooks/useIsMobile'

interface Props {
    onClick?: () => void
    children: ReactNode
    style?: CSSProperties
}

// app/src/ui/FAB.tsx の移植。webではモバイル幅のときのみ表示する。
// ドロワーのtransformやComposerのoverflow:hiddenの影響を受けないようbodyへportalする
export const FAB = (props: Props) => {
    const isMobile = useIsMobile()

    const [pressed, setPressed] = useState(false)

    const handlePointerDown = (e: PointerEvent<HTMLButtonElement>) => {
        e.currentTarget.setPointerCapture(e.pointerId)
        setPressed(true)
    }

    const resetPressed = () => {
        setPressed(false)
    }

    if (!isMobile) return null

    return createPortal(
        <motion.button
            onClick={props.onClick}
            onPointerDown={handlePointerDown}
            onPointerUp={resetPressed}
            onPointerCancel={resetPressed}
            onPointerLeave={resetPressed}
            onBlur={resetPressed}
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
                ...(pressed && { filter: 'brightness(0.9)' }),
                ...props.style
            }}
            initial={{ scale: 0 }}
            animate={{ scale: 1, transition: { type: 'spring', stiffness: 260, damping: 20 } }}
            exit={{ scale: 0, transition: { type: 'tween', duration: 0.2 } }}
        >
            {props.children}
        </motion.button>,
        document.body
    )
}
