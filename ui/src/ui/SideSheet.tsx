import { type ReactNode } from 'react'
import { motion, useMotionValue, useTransform } from 'motion/react'
import { CssVar } from '../types/Theme'

interface Props {
    onDismiss: () => void
    width?: number
    children: ReactNode
}

export const SideSheet = (props: Props) => {
    const x = useMotionValue(0)

    const width = props.width ?? Math.min(window.innerWidth, 420)
    const backdropOpacity = useTransform(x, [0, width], [0.5, 0])

    return (
        <>
            <motion.div
                style={{
                    position: 'fixed',
                    inset: 0,
                    background: 'black',
                    opacity: backdropOpacity
                }}
                onClick={() => {
                    props.onDismiss()
                }}
            />
            <motion.div
                style={{
                    backgroundColor: CssVar.contentBackground,
                    color: CssVar.contentText,
                    position: 'absolute',
                    top: 0,
                    right: 0,
                    bottom: 0,
                    paddingRight: 'env(safe-area-inset-right)',
                    borderRadius: `${CssVar.round(1)} 0 0 ${CssVar.round(1)}`,
                    width,
                    maxWidth: '100vw',
                    x,
                    display: 'flex',
                    flexDirection: 'column'
                }}
                initial={{ x: width }}
                animate={{ x: 0 }}
                transition={{ type: 'tween', ease: 'easeOut', duration: 0.2 }}
                exit={{ x: width }}
            >
                <div
                    style={{
                        padding: `0 ${CssVar.space(4)}`,
                        flex: 1,
                        display: 'flex',
                        minHeight: 0
                    }}
                >
                    {props.children}
                </div>
            </motion.div>
        </>
    )
}
