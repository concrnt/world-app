import { ReactNode } from 'react'
import { useTheme } from '../contexts/Theme'
import { motion } from 'motion/react'

interface Props {
    selected?: boolean
    children: ReactNode
    onClick?: () => void
    groupId?: string
    style?: React.CSSProperties
}

export const Tab = (props: Props) => {
    const theme = useTheme()

    return (
        <div
            style={{
                padding: 'var(--space-2)',
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
                        height: 'var(--space-1)',
                        backgroundColor: props.style?.color ?? theme.backdrop.text,
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
