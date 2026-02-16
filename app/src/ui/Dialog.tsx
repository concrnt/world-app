import { CSSProperties } from 'react'
import { useTheme } from '../contexts/Theme'
import { AnimatePresence, motion } from 'motion/react'

interface Props {
    open: boolean
    onClose: () => void
    children: React.ReactNode
    style?: CSSProperties
}

export const Dialog = (props: Props) => {
    const theme = useTheme()

    if (!props.open) {
        return null
    }

    return (
        <AnimatePresence>
            <motion.div
                style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: '100%',
                    backgroundColor: 'rgba(0, 0, 0, 0.5)'
                }}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                onClick={props.onClose}
            >
                <div
                    style={{
                        position: 'absolute',
                        top: '30%',
                        left: '50%',
                        transform: 'translate(-50%, -50%)',
                        backgroundColor: theme.content.background,
                        width: 'var(--dialog-w)',
                        maxWidth: 'var(--dialog-max-w)',
                        ...props.style
                    }}
                    onClick={(e) => e.stopPropagation()}
                >
                    {props.children}
                </div>
            </motion.div>
        </AnimatePresence>
    )
}
