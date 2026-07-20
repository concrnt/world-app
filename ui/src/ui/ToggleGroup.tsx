import { useId } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import { motion } from 'motion/react'
import { CssVar } from '../types/Theme'
import { ButtonBase } from './ButtonBase'

interface Props<T extends string> {
    options: Array<{ value: T; label: ReactNode }>
    value: T
    onChange: (value: T) => void
    disabled?: boolean
    style?: CSSProperties
}

const trackStyle: CSSProperties = {
    display: 'flex',
    alignItems: 'stretch',
    width: '100%',
    padding: CssVar.space(1),
    gap: CssVar.space(1),
    borderRadius: CssVar.round(2),
    backgroundColor: 'rgb(from currentcolor r g b / 0.08)'
}

const itemStyle: CSSProperties = {
    position: 'relative',
    flex: 1,
    minWidth: 0,
    padding: `${CssVar.space(2)} ${CssVar.space(2)}`,
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: CssVar.round(1.5),
    font: 'inherit',
    color: 'inherit'
}

const pressedStyle: CSSProperties = {
    backgroundColor: 'rgb(from currentcolor r g b / 0.08)'
}

export const ToggleGroup = <T extends string>(props: Props<T>) => {
    const groupId = useId()

    return (
        <div role="radiogroup" style={{ ...trackStyle, ...props.style }}>
            {props.options.map((option) => {
                const selected = option.value === props.value
                return (
                    <ButtonBase
                        key={option.value}
                        role="radio"
                        aria-checked={selected}
                        disabled={props.disabled}
                        onClick={() => {
                            if (!selected) props.onChange(option.value)
                        }}
                        style={itemStyle}
                        pressedStyle={selected ? undefined : pressedStyle}
                    >
                        {selected && (
                            <motion.div
                                layoutId={'toggle-group-pill-' + groupId}
                                style={{
                                    position: 'absolute',
                                    inset: 0,
                                    borderRadius: CssVar.round(1.5),
                                    backgroundColor: 'rgb(from currentcolor r g b / 0.16)'
                                }}
                                transition={{ type: 'spring', stiffness: 500, damping: 40 }}
                            />
                        )}
                        <span
                            style={{
                                position: 'relative',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                                opacity: selected ? 1 : 0.65,
                                fontWeight: selected ? 600 : 500
                            }}
                        >
                            {option.label}
                        </span>
                    </ButtonBase>
                )
            })}
        </div>
    )
}
