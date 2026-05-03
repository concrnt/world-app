import { Chip } from '@concrnt/ui'

import { Suspense, use, useMemo, useRef, useState } from 'react'

import { IoMdAdd } from 'react-icons/io'

import { useClient } from '../contexts/Client'
import { Avatar } from '@concrnt/ui'
import { CssVar } from '../types/Theme'
import { hapticSelection } from '../utils/haptics'
import { User } from '@concrnt/worldlib'
import { useSubscribe } from '../hooks/useSubscribe'

interface Props {
    selected: string[]
    setSelected: (selected: string[]) => void
}

export const UserPicker = (props: Props) => {
    const { client } = useClient()

    const [focused, setFocused] = useState(false)
    const [focusedIdx, setFocusedIdx] = useState<number>(0)

    const [filter, setFilter] = useState('')

    const inputRef = useRef<HTMLInputElement>(null)

    const [acknowledging] = useSubscribe(client.acknowledgingUsers)

    const options = useMemo(() => {
        const remains = acknowledging.filter((i) => !props.selected.some((s) => s === i.ccid))
        if (filter === '') return remains
        return remains.filter((i) => i.profile.username?.toLowerCase().includes(filter.toLowerCase()))
    }, [props, filter, acknowledging])

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
                return (
                    <UserChip
                        key={sel}
                        ccid={sel}
                        onClick={() => {
                            props.setSelected(props.selected.filter((s) => s !== sel))
                        }}
                    />
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
                                    props.setSelected([...props.selected, options[focusedIdx].ccid])
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
                        hapticSelection()
                        setFocused(true)
                    }}
                    style={{
                        color: CssVar.divider
                    }}
                    tailElement={<IoMdAdd size={16} />}
                >
                    ユーザーを追加
                </Chip>
            )}
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
                        backgroundColor: CssVar.contentBackground
                    }}
                >
                    {options.map((opt) => (
                        <div
                            key={opt.ccid}
                            style={{
                                padding: '8px',
                                cursor: 'pointer',
                                borderBottom: `1px solid ${CssVar.divider}`,
                                backgroundColor: focusedIdx === options.indexOf(opt) ? CssVar.divider : 'transparent'
                            }}
                            onMouseDown={() => {
                                props.selected.push(opt.ccid)
                            }}
                        >
                            {opt.profile.username}
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}

interface UserPickerProps {
    ccid: string
    onClick: () => void
}

const UserChip = (props: UserPickerProps) => {
    const { client } = useClient()

    const userPromise = useMemo(() => {
        return client.getUser(props.ccid)
    }, [props.ccid, client])

    return (
        <Suspense fallback={<Chip>読み込み中...</Chip>}>
            <UserChipBody ccid={props.ccid} userPromise={userPromise} onClick={props.onClick} />
        </Suspense>
    )
}

interface BodyProps {
    ccid: string
    userPromise: Promise<User | null>
    onClick: () => void
}

const UserChipBody = (props: BodyProps) => {
    const user = use(props.userPromise)

    if (!user) {
        return <Chip>{props.ccid}</Chip>
    }

    return (
        <Chip
            headElement={
                <Avatar
                    ccid={user.ccid}
                    src={user.profile.avatar}
                    style={{
                        width: 20,
                        height: 20
                    }}
                />
            }
            onClick={props.onClick}
        >
            {user.profile.username}
        </Chip>
    )
}
