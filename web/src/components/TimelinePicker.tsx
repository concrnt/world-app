import { Avatar, Chip, CssVar } from '@concrnt/ui'
import { useMemo, useRef, useState } from 'react'
import { IoMdAdd, IoMdCloseCircle } from 'react-icons/io'
import { MdOutlineTag } from 'react-icons/md'
import { useClient } from '../contexts/Client'

interface Props<T> {
    selected: string[]
    setSelected: (selected: string[]) => void
    items: T[]
    keyFunc: (item: T) => string
    labelFunc: (item: T) => string
    postHome?: boolean
    setPostHome?: (postHome: boolean) => void
}

export const TimelinePicker = <T,>(props: Props<T>) => {
    const { client } = useClient()
    const [focused, setFocused] = useState(false)
    const [filter, setFilter] = useState('')
    const inputRef = useRef<HTMLInputElement | null>(null)

    const options = useMemo(() => {
        const remains = props.items.filter((item) => !props.selected.includes(props.keyFunc(item)))
        if (!filter) return remains

        return remains.filter((item) => props.labelFunc(item).toLowerCase().includes(filter.toLowerCase()))
    }, [filter, props])

    return (
        <div
            style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: CssVar.space(2),
                position: 'relative',
                alignItems: 'center'
            }}
        >
            <Chip
                headElement={
                    <Avatar
                        ccid={client?.ccid ?? ''}
                        src={client?.profile.avatar}
                        style={{ width: 20, height: 20 }}
                    />
                }
                tailElement={
                    props.setPostHome ? (
                        <IoMdCloseCircle
                            size={16}
                            style={{
                                transform: props.postHome === false ? 'rotate(45deg)' : 'none',
                                transition: 'transform 0.2s'
                            }}
                            onClick={(event) => {
                                event.stopPropagation()
                                props.setPostHome?.(!props.postHome)
                            }}
                        />
                    ) : undefined
                }
                style={{
                    textDecoration: props.postHome === false ? 'line-through' : 'none',
                    opacity: props.postHome === false ? 0.5 : 1
                }}
            >
                Home
            </Chip>

            {props.selected.map((selected) => {
                const item = props.items.find((candidate) => props.keyFunc(candidate) === selected)
                if (!item) return null

                return (
                    <Chip
                        key={selected}
                        headElement={<MdOutlineTag size={16} />}
                        tailElement={
                            <IoMdCloseCircle
                                size={16}
                                onClick={() => {
                                    props.setSelected(props.selected.filter((value) => value !== selected))
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
                    value={filter}
                    placeholder="投稿先を検索"
                    onChange={(event) => setFilter(event.target.value)}
                    onBlur={() => {
                        setFocused(false)
                        setFilter('')
                    }}
                    style={{
                        flex: 1,
                        minWidth: '180px',
                        border: `1px solid ${CssVar.divider}`,
                        outline: 'none',
                        padding: CssVar.space(2),
                        borderRadius: CssVar.round(1),
                        backgroundColor: CssVar.contentBackground,
                        color: CssVar.contentText
                    }}
                />
            ) : (
                <Chip
                    variant="outlined"
                    onClick={() => {
                        setFocused(true)
                    }}
                    tailElement={<IoMdAdd size={16} />}
                >
                    投稿先を追加
                </Chip>
            )}

            {focused && options.length > 0 && (
                <div
                    style={{
                        position: 'absolute',
                        width: '100%',
                        top: '100%',
                        left: 0,
                        marginTop: CssVar.space(2),
                        borderRadius: CssVar.round(1),
                        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)',
                        zIndex: 1000,
                        backgroundColor: CssVar.contentBackground,
                        overflow: 'hidden'
                    }}
                >
                    {options.map((option) => (
                        <button
                            key={props.keyFunc(option)}
                            type="button"
                            onMouseDown={() => {
                                props.setSelected([...props.selected, props.keyFunc(option)])
                            }}
                            style={{
                                width: '100%',
                                padding: CssVar.space(2),
                                border: 'none',
                                borderBottom: `1px solid ${CssVar.divider}`,
                                backgroundColor: 'transparent',
                                textAlign: 'left',
                                color: CssVar.contentText,
                                cursor: 'pointer'
                            }}
                        >
                            {props.labelFunc(option)}
                        </button>
                    ))}
                </div>
            )}
        </div>
    )
}
