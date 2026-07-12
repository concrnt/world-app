import { type ReactNode } from 'react'
import { motion } from 'motion/react'
import { CssVar } from '../types/Theme'

interface Props {
    onBackdropClick?: () => void
    children: ReactNode
}

export const CenterDialog = (props: Props) => {
    return (
        <>
            <motion.div
                style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: '100%',
                    backgroundColor: 'black'
                }}
                initial={{ opacity: 0 }}
                animate={{ opacity: 0.5 }}
                exit={{ opacity: 0 }}
            />
            <div
                style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                }}
                onClick={props.onBackdropClick}
            >
                <motion.div
                    style={{
                        backgroundColor: CssVar.contentBackground,
                        color: CssVar.contentText,
                        padding: CssVar.space(2),
                        borderRadius: CssVar.round(1),
                        width: 'min(480px, 80vw)',
                        position: 'absolute',
                        top: '30%'
                    }}
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    onClick={(e) => {
                        e.stopPropagation()
                    }}
                >
                    {props.children}
                </motion.div>
            </div>
        </>
    )
}
