import { Chip } from '../ui/Chip'

import { useTheme } from '../contexts/Theme'
import { useMemo, useRef, useState } from 'react'

import { MdOutlineTag } from 'react-icons/md'
import { IoMdCloseCircle } from 'react-icons/io'
import { IoMdAdd } from 'react-icons/io'

interface Props {
    selected: string[]
    setSelected: (selected: string[]) => void
    items: any[]
    keyFunc: (item: any) => string
    labelFunc: (item: any) => string
}

export const TimelinePicker = (props: Props) => {
    const theme = useTheme()
    const [focused, setFocused] = useState(false)
    const [focusedIdx, setFocusedIdx] = useState<number>(0)

    const [filter, setFilter] = useState('')

    const inputRef = useRef<HTMLInputElement>(null)

    const options = useMemo(() => {
        const remains = props.items.filter((i) => !props.selected.includes(props.keyFunc(i)))
        if (filter === '') return remains
        return remains.filter((i) => props.labelFunc(i).toLowerCase().includes(filter.toLowerCase()))
    }, [props, filter])

    return (
        <div
            style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: '8px',
                position: 'relative',
                alignItems: 'center'
            }}
        >
            {props.selected.map((sel) => {
                const item = props.items.find((i) => props.keyFunc(i) === sel)
                if (!item) return null
                return (
                    <Chip
                        key={sel}
                        headElement={<MdOutlineTag size={16} />}
                        tailElement={
                            <IoMdCloseCircle
                                size={16}
                                onClick={() => {
                                    props.setSelected(props.selected.filter((s) => s !== sel))
                                }}
                            />
                        }
                    >
                        {props.labelFunc(item)}
                    </Chip>
                )
            })}
            {!focused && (
                <Chip
                    variant="outlined"
                    onClick={() => {
                        inputRef.current?.focus()
                    }}
                    style={{
                        color: theme.divider
                    }}
                    tailElement={<IoMdAdd size={16} />}
                >
                    投稿先を追加
                </Chip>
            )}
            <input
                ref={inputRef}
                type="text"
                style={{
                    flex: '1',
                    minWidth: '120px',
                    border: 'none',
                    outline: 'none',
                    padding: '8px',
                    borderRadius: '4px',
                    background: 'transparent'
                }}
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                onFocus={() => setFocused(true)}
                onBlur={() => {
                    setFocused(false)
                    setFilter('')
                    setFocusedIdx(0)
                }}
                onKeyDown={(e) => {
                    switch (e.key) {
                        case 'Escape':
                            inputRef.current?.blur()
                            break
                        case 'Enter':
                            if (options.length > 0 && focusedIdx >= 0 && focusedIdx < options.length) {
                                props.selected.push(props.keyFunc(options[focusedIdx]))
                                inputRef.current?.blur()
                            }
                            break
                        case 'ArrowDown':
                            e.preventDefault()
                            setFocusedIdx((prev) => (prev + 1) % options.length)
                            break
                        case 'ArrowUp':
                            e.preventDefault()
                            setFocusedIdx((prev) => (prev - 1 + options.length) % options.length)
                            break
                    }
                }}
            />
            {focused && (
                <div
                    style={{
                        position: 'absolute',
                        width: '100%',
                        top: '100%',
                        left: 0,
                        borderRadius: '4px',
                        marginTop: '4px',
                        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)',
                        zIndex: 1000,
                        backgroundColor: theme.content.background
                    }}
                >
                    {options.map((opt) => (
                        <div
                            key={props.keyFunc(opt)}
                            style={{
                                padding: '8px',
                                cursor: 'pointer',
                                borderBottom: `1px solid ${theme.divider}`,
                                backgroundColor: focusedIdx === options.indexOf(opt) ? theme.divider : 'transparent'
                            }}
                            onMouseDown={() => {
                                props.selected.push(props.keyFunc(opt))
                            }}
                        >
                            {props.labelFunc(opt)}
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}
