import type { ReactNode } from 'react'
import { motion } from 'motion/react'
import { CssVar } from '../types/Theme'

interface Props {
    selected?: boolean
    children: ReactNode
    onClick?: () => void
    groupId?: string
    style?: React.CSSProperties
}

export const Tab = (props: Props) => {
    return (
        <div
            style={{
                padding: '0.5rem',
                position: 'relative',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                ...props.style
            }}
            onClick={props.onClick}
        >
            {props.children}
            {props.selected && (
                <motion.div
                    layoutId={'tab-underline-' + props.groupId}
                    style={{
                        position: 'absolute',
                        height: '4px',
                        backgroundColor: props.style?.color ?? CssVar.backdropText,
                        bottom: 0,
                        left: 0,
                        right: 0
                    }}
                    transition={{ type: 'spring', stiffness: 500, damping: 40 }}
                />
            )}
        </div>
    )
}
