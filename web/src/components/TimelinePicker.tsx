import { Chip } from '@concrnt/ui'

import { useMemo, useRef, useState } from 'react'

import { MdOutlineTag } from 'react-icons/md'
import { IoMdCloseCircle } from 'react-icons/io'
import { IoMdAdd } from 'react-icons/io'

import { useClient } from '../contexts/Client'
import { Avatar, ListItem, useAnchor } from '@concrnt/ui'
import { CssVar } from '../types/Theme'
import { hapticSelection } from '../utils/haptics'
import { useSelect } from '../contexts/Select'
import { ProfileName } from './ProfileName'

interface Props {
    selected: string[]
    setSelected: (selected: string[]) => void
    items: any[]
    keyFunc: (item: any) => string
    labelFunc: (item: any) => string
    postHome?: boolean
    setPostHome?: (postHome: boolean) => void
    selectedProfile?: string
    setSelectedProfile?: (profile: string) => void
}

export const TimelinePicker = (props: Props) => {
    const { client } = useClient()
    const { select, close } = useSelect()
    const profileAnchor = useAnchor()

    const [focused, setFocused] = useState(false)
    const [focusedIdx, setFocusedIdx] = useState<number>(0)

    const [filter, setFilter] = useState('')

    const inputRef = useRef<HTMLInputElement>(null)

    const options = useMemo(() => {
        const remains = props.items.filter((i) => !props.selected.includes(props.keyFunc(i)))
        if (filter === '') return remains
        return remains.filter((i) => props.labelFunc(i).toLowerCase().includes(filter.toLowerCase()))
    }, [props, filter])

    // 投稿元プロフィール（未指定時はクライアントのcurrentProfileにフォールバック）
    const activeProfile = props.selectedProfile ?? client?.currentProfile ?? 'main'
    const activeProfileDoc = client?.profiles?.[activeProfile]
    const profileAvatar = activeProfileDoc?.value.avatar ?? client?.profile.avatar
    const profileUsername = activeProfileDoc?.value.username ?? client?.profile.username ?? 'Home'

    const openProfileSelect = () => {
        if (!client) return
        const profileOptions = Object.entries(client.profiles).map(([key, profile]) => (
            <ListItem
                key={key}
                icon={
                    <Avatar
                        ccid={profile.author}
                        src={profile.value.avatar}
                        style={{ width: '32px', height: '32px' }}
                    />
                }
                onClick={() => {
                    props.setSelectedProfile?.(key)
                    close()
                }}
            >
                <div
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        paddingLeft: CssVar.space(2)
                    }}
                >
                    <ProfileName document={profile} />
                </div>
            </ListItem>
        ))
        select('投稿元プロフィール', profileOptions, profileAnchor)
    }

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
            <Chip
                onClick={() => {
                    if (!props.setSelectedProfile) return
                    hapticSelection()
                    openProfileSelect()
                }}
                headElement={
                    <Avatar
                        ccid={client?.ccid ?? ''}
                        src={profileAvatar}
                        style={{
                            width: 20,
                            height: 20
                        }}
                    />
                }
                tailElement={
                    <IoMdCloseCircle
                        size={16}
                        style={{
                            transform: props.postHome === false ? 'rotate(45deg)' : 'none',
                            transition: 'transform 0.2s'
                        }}
                        onClick={(e) => {
                            e.stopPropagation()
                            props.setPostHome?.(!props.postHome)
                        }}
                    />
                }
                style={
                    {
                        textDecoration: props.postHome === false ? 'line-through' : 'none',
                        opacity: props.postHome === false ? 0.5 : 1,
                        anchorName: profileAnchor
                    } as React.CSSProperties
                }
            >
                {profileUsername}
            </Chip>
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
                        hapticSelection()
                        setFocused(true)
                    }}
                    style={{
                        color: CssVar.divider
                    }}
                    tailElement={<IoMdAdd size={16} />}
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
                        borderRadius: '4px',
                        marginTop: '4px',
                        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)',
                        zIndex: 1000,
                        backgroundColor: CssVar.contentBackground
                    }}
                >
                    {options.map((opt) => (
                        <div
                            key={props.keyFunc(opt)}
                            style={{
                                padding: '8px',
                                cursor: 'pointer',
                                borderBottom: `1px solid ${CssVar.divider}`,
                                backgroundColor: focusedIdx === options.indexOf(opt) ? CssVar.divider : 'transparent'
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
