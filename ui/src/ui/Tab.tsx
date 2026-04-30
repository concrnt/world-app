import type { CSSProperties, MouseEvent, ReactNode } from 'react'
import { motion } from 'motion/react'
import { CssVar } from '../types/Theme'
import { ButtonBase } from './ButtonBase'

interface Props {
    selected?: boolean
    children: ReactNode
    onClick?: (e: MouseEvent<HTMLButtonElement>) => void
    groupId?: string
    style?: CSSProperties
}

const pressedStyle: CSSProperties = {
    backgroundColor: `rgb(from ${CssVar.backdropText} r g b / 0.08)`
}

const indicatorInlineInset = `calc(${CssVar.space(1)} / 2)`
const indicatorHeight = '4px'
const indicatorGap = CssVar.space(1)

export const Tab = (props: Props) => {
    return (
        <ButtonBase
            style={{
                flex: 1,
                width: '100%',
                padding: '0.5rem',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                borderRadius: CssVar.round(1),
                ...props.style
            }}
            onClick={props.onClick}
            pressedStyle={pressedStyle}
        >
            <div
                style={{
                    position: 'relative',
                    display: 'inline-flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    paddingInline: indicatorInlineInset,
                    paddingBottom: `calc(${indicatorGap} + ${indicatorHeight})`
                }}
            >
                {props.children}
                {props.selected && (
                    <motion.div
                        layoutId={'tab-underline-' + props.groupId}
                        style={{
                            position: 'absolute',
                            height: indicatorHeight,
                            backgroundColor: props.style?.color ?? CssVar.backdropText,
                            bottom: 0,
                            left: 0,
                            right: 0
                        }}
                        transition={{ type: 'spring', stiffness: 500, damping: 40 }}
                    />
                )}
            </div>
        </ButtonBase>
    )
}
