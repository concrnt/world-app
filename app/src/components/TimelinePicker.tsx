import { Chip } from '../ui/Chip'

import { useTheme } from '../contexts/Theme'
import { useMemo, useRef, useState } from 'react'

import { MdOutlineTag } from 'react-icons/md'
import { IoMdCloseCircle } from 'react-icons/io'
import { IoMdAdd } from 'react-icons/io'

import { useClient } from '../contexts/Client'
import { Avatar } from '../ui/Avatar'

interface Props {
    selected: string[]
    setSelected: (selected: string[]) => void
    items: any[]
    keyFunc: (item: any) => string
    labelFunc: (item: any) => string
    postHome?: boolean
    setPostHome?: (postHome: boolean) => void
}

const timelineIconStyle: React.CSSProperties = {
    fontSize: 'var(--timeline-icon-size, 14px)'
}

const timelineChipVPad: React.CSSProperties = {
    paddingTop: 'var(--timeline-chip-pad-v, 7px)',
    paddingBottom: 'var(--timeline-chip-pad-v, 7px)'
}

export const TimelinePicker = (props: Props) => {
    const theme = useTheme()
    const { client } = useClient()

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
                gap: 'var(--space-2)',
                position: 'relative',
                alignItems: 'center'
            }}
        >
            <Chip
                headIconRound
                headElement={
                    <Avatar
                        ccid={client?.ccid ?? ''}
                        src={client?.user?.profile?.avatar}
                        style={{
                            width: 'var(--timeline-avatar-size, 17px)',
                            height: 'var(--timeline-avatar-size, 17px)',
                            borderRadius: '50%'
                        }}
                    />
                }
                tailElement={
                    <IoMdCloseCircle
                        style={{
                            ...timelineIconStyle,
                            transform: props.postHome === false ? 'rotate(45deg)' : 'none',
                            transition: 'transform 0.2s'
                        }}
                        onClick={(e) => {
                            e.stopPropagation()
                            props.setPostHome?.(!props.postHome)
                        }}
                    />
                }
                style={{
                    ...timelineChipVPad,
                    textDecoration: props.postHome === false ? 'line-through' : 'none',
                    opacity: props.postHome === false ? 0.5 : 1
                }}
            >
                {client?.user?.profile?.username ?? 'Home'}
            </Chip>
            {props.selected.map((sel) => {
                const item = props.items.find((i) => props.keyFunc(i) === sel)
                if (!item) return null
                return (
                    <Chip
                        key={sel}
                        headIconRound
                        style={{ ...timelineChipVPad }}
                        headElement={<MdOutlineTag style={timelineIconStyle} />}
                        tailElement={
                            <IoMdCloseCircle
                                style={timelineIconStyle}
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
            {focused ? (
                <input
                    ref={inputRef}
                    autoFocus
                    type="text"
                    style={{
                        flex: '1',
                        border: 'none',
                        outline: 'none',
                        padding: 'var(--space-2)',
                        borderRadius: 'var(--radius-sm)',
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
            ) : (
                <Chip
                    variant="outlined"
                    onClick={() => {
                        setFocused(true)
                    }}
                    style={{
                        ...timelineChipVPad,
                        color: theme.divider
                    }}
                    tailElement={<IoMdAdd style={timelineIconStyle} />}
                >
                    投稿先を追加
                </Chip>
            )}
            {focused && (
                <div
                    style={{
                        position: 'absolute',
                        width: '100%',
                        top: '100%',
                        left: 0,
                        borderRadius: 'var(--radius-sm)',
                        marginTop: 'var(--space-1)',
                        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)',
                        zIndex: 1000,
                        backgroundColor: theme.content.background
                    }}
                >
                    {options.map((opt) => (
                        <div
                            key={props.keyFunc(opt)}
                            style={{
                                padding: 'var(--space-2)',
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
