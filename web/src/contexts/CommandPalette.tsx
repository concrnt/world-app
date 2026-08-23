import { type ReactNode, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { motion } from 'motion/react'
import { MdSearch, MdTag } from 'react-icons/md'
import { Avatar, Divider, List, ListItem, OverlaySurface, Text, TextField } from '@concrnt/ui'

import { CssVar } from '../types/Theme'
import { type CommunityHit, type UserHit, fetchSearch } from '../components/SearchExplorer'

// v1(concrnt-world)のCommandPaletteのweb移植。Ctrl/Cmd+Kでクイックスイッチャーを開き、
// crawlerのコミュニティ/ユーザー検索結果を矢印キー+Enterで選んで遷移する

interface Props {
    children: ReactNode
}

interface Results {
    communities: CommunityHit[] | null
    users: UserHit[] | null
}

export const CommandPaletteProvider = (props: Props) => {
    const { t } = useTranslation('', { keyPrefix: 'contexts.commandPalette' })
    const navigate = useNavigate()

    const [open, setOpen] = useState(false)
    const [query, setQuery] = useState('')
    const [results, setResults] = useState<Results | undefined>(undefined)
    const [selectedIndex, setSelectedIndex] = useState(0)
    const listRef = useRef<HTMLDivElement>(null)

    const reset = (): void => {
        setOpen(false)
        setQuery('')
        setResults(undefined)
        setSelectedIndex(0)
    }

    useEffect(() => {
        const onKeyDown = (e: KeyboardEvent): void => {
            if ((e.ctrlKey || e.metaKey) && !e.altKey && e.key.toLowerCase() === 'k') {
                e.preventDefault()
                setOpen(true)
            }
        }
        window.addEventListener('keydown', onKeyDown)
        return () => window.removeEventListener('keydown', onKeyDown)
    }, [])

    useEffect(() => {
        if (!query) return
        let cancelled = false
        const timer = setTimeout(() => {
            Promise.all([fetchSearch('communities', query), fetchSearch('users', query)]).then(([c, u]) => {
                if (cancelled) return
                setResults({ communities: c as CommunityHit[] | null, users: u as UserHit[] | null })
                setSelectedIndex(0)
            })
        }, 200)
        return () => {
            cancelled = true
            clearTimeout(timer)
        }
    }, [query])

    const communities = results?.communities ?? []
    const users = results?.users ?? []
    const total = communities.length + users.length
    const unavailable = results !== undefined && results.communities === null && results.users === null

    const go = (index: number): void => {
        if (index < communities.length) {
            navigate('/timeline/' + encodeURIComponent(communities[index].cckv))
        } else {
            const user = users[index - communities.length]
            if (!user) return
            navigate('/profile/' + encodeURIComponent(user.ccid))
        }
        reset()
    }

    // 選択行が見える位置までスクロール
    useEffect(() => {
        listRef.current
            ?.querySelector<HTMLElement>(`[data-index="${selectedIndex}"]`)
            ?.scrollIntoView({ block: 'nearest' })
    }, [selectedIndex])

    const onInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>): void => {
        if (e.nativeEvent.isComposing) return
        switch (e.key) {
            case 'Escape':
                e.preventDefault()
                reset()
                break
            case 'ArrowUp':
                e.preventDefault()
                if (total > 0) setSelectedIndex((selectedIndex - 1 + total) % total)
                break
            case 'ArrowDown':
                e.preventDefault()
                if (total > 0) setSelectedIndex((selectedIndex + 1) % total)
                break
            case 'Enter':
                e.preventDefault()
                if (total > 0) go(selectedIndex)
                break
        }
    }

    const selectedStyle = {
        backgroundColor: `rgb(from ${CssVar.contentLink} r g b / 0.15)`,
        borderRadius: CssVar.round(1)
    }

    return (
        <>
            {props.children}
            <OverlaySurface open={open} onClose={reset}>
                <motion.div
                    style={{ position: 'fixed', inset: 0, backgroundColor: 'black' }}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 0.5 }}
                    exit={{ opacity: 0 }}
                />
                <div
                    data-testid="command-palette"
                    style={{
                        position: 'fixed',
                        inset: 0,
                        display: 'flex',
                        justifyContent: 'center',
                        alignItems: 'flex-start'
                    }}
                    onClick={reset}
                >
                    <motion.div
                        style={{
                            marginTop: '15vh',
                            width: 'min(700px, 90vw)',
                            maxHeight: '60vh',
                            display: 'flex',
                            flexDirection: 'column',
                            backgroundColor: CssVar.contentBackground,
                            color: CssVar.contentText,
                            borderRadius: CssVar.round(1),
                            padding: CssVar.space(1),
                            boxSizing: 'border-box'
                        }}
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div style={{ display: 'flex', alignItems: 'center', gap: CssVar.space(1) }}>
                            <MdSearch size={24} style={{ flexShrink: 0, opacity: 0.6 }} />
                            <TextField
                                autofocus
                                value={query}
                                placeholder={t('placeholder')}
                                onChange={(e) => {
                                    setQuery(e.target.value)
                                    if (!e.target.value) {
                                        setResults(undefined)
                                        setSelectedIndex(0)
                                    }
                                }}
                                onKeyDown={onInputKeyDown}
                            />
                        </div>
                        {results !== undefined && <Divider style={{ margin: `${CssVar.space(1)} 0` }} />}
                        <div ref={listRef} style={{ overflowY: 'auto', minHeight: 0 }}>
                            {unavailable && (
                                <Text variant="caption" style={{ padding: CssVar.space(1) }}>
                                    {t('unavailable')}
                                </Text>
                            )}
                            {results !== undefined && !unavailable && total === 0 && (
                                <Text variant="caption" style={{ padding: CssVar.space(1) }}>
                                    {t('noResults')}
                                </Text>
                            )}
                            {communities.length > 0 && (
                                <>
                                    <Text variant="caption" style={{ padding: `0 ${CssVar.space(1)}`, opacity: 0.6 }}>
                                        {t('communities')}
                                    </Text>
                                    <List dense>
                                        {communities.map((c, i) => (
                                            <div
                                                key={c.id}
                                                data-index={i}
                                                style={selectedIndex === i ? selectedStyle : undefined}
                                            >
                                                <ListItem startIcon={<MdTag size={20} />} onClick={() => go(i)}>
                                                    <div
                                                        style={{
                                                            display: 'flex',
                                                            flexDirection: 'column',
                                                            minWidth: 0
                                                        }}
                                                    >
                                                        <Text style={ellipsis}>{c.name}</Text>
                                                        {c.description && (
                                                            <Text
                                                                variant="caption"
                                                                style={{ ...ellipsis, opacity: 0.6 }}
                                                            >
                                                                {c.description}
                                                            </Text>
                                                        )}
                                                    </div>
                                                </ListItem>
                                            </div>
                                        ))}
                                    </List>
                                </>
                            )}
                            {users.length > 0 && (
                                <>
                                    <Text variant="caption" style={{ padding: `0 ${CssVar.space(1)}`, opacity: 0.6 }}>
                                        {t('users')}
                                    </Text>
                                    <List dense>
                                        {users.map((u, i) => {
                                            const index = communities.length + i
                                            return (
                                                <div
                                                    key={u.id}
                                                    data-index={index}
                                                    style={selectedIndex === index ? selectedStyle : undefined}
                                                >
                                                    <ListItem
                                                        startIcon={
                                                            <Avatar
                                                                ccid={u.ccid}
                                                                src={u.avatar}
                                                                style={{ width: 24, height: 24, borderRadius: '4px' }}
                                                            />
                                                        }
                                                        onClick={() => go(index)}
                                                    >
                                                        <Text style={ellipsis}>{u.username ?? 'Anonymous'}</Text>
                                                    </ListItem>
                                                </div>
                                            )
                                        })}
                                    </List>
                                </>
                            )}
                        </div>
                    </motion.div>
                </div>
            </OverlaySurface>
        </>
    )
}

const ellipsis = { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } as const
