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
const tabPadding = '0.5rem'

export const Tab = (props: Props) => {
    return (
        <ButtonBase
            style={{
                flex: 1,
                width: '100%',
                minHeight: '48px',
                // 下paddingは持たせず、インジケーターをボタン下端(=Tabsの下線)に密着させる
                padding: `${tabPadding} ${tabPadding} 0`,
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                fontSize: '0.9rem',
                fontWeight: 500,
                fontFamily: 'inherit',
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
                    // ボタンの下端まで伸ばし、インジケーターの位置をボタン下端に揃える
                    alignSelf: 'stretch',
                    paddingInline: indicatorInlineInset,
                    // 上paddingと同量ぶん下を空け、ラベルをボタンの中央に保つ
                    paddingBottom: tabPadding
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
