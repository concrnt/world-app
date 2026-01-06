import { ReactNode } from 'react'
import { useTheme } from '../contexts/Theme'
import { motion } from 'motion/react'

interface Props {
    selected?: boolean
    children: ReactNode
    onClick?: () => void
    groupId?: string
}

export const Tab = (props: Props) => {
    const theme = useTheme()

    return (
        <div
            style={{
                cursor: 'pointer',
                padding: '0.5rem',
                color: theme.ui.text,
                position: 'relative'
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
                        backgroundColor: theme.ui.text,
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
