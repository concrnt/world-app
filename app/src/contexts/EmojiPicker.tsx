import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { CssVar } from '../types/Theme'
import { useLocalStorage } from '../hooks/useLocalStorage'
import { MdAccessTime, MdSearch, MdClose } from 'react-icons/md'
import { IconButton } from '@concrnt/ui'
import { useClient } from './Client'
import { useKeyboard } from './Keyboard'
import { EMOJI_PACKAGE_SCHEMA, ensureEmojiPackageList } from '../utils/emojiPackages'
import type { List } from '@concrnt/worldlib'

// ---- Types ----

export interface Emoji {
    shortcode: string
    imageURL: string
    keywords?: string
}

export interface RawEmojiPackage {
    name: string
    iconURL: string
    emojis: Emoji[]
}

export interface EmojiPackage extends RawEmojiPackage {
    packageURL: string
    fetchedAt: Date
}

// ---- Constants ----

const COLS = 7

// ---- Context ----

export interface EmojiPickerState {
    open: (onSelected: (emoji: Emoji) => void) => void
    close: () => void
    search: (input: string, limit?: number) => Emoji[]
    packages: EmojiPackage[]
    packageURLs: string[]
    addEmojiPackage: (url: string) => Promise<void>
    removeEmojiPackage: (url: string) => Promise<void>
    updateEmojiPackage: (url: string) => Promise<void>
}

const EmojiPickerContext = createContext<EmojiPickerState | undefined>(undefined)

interface Props {
    children: React.ReactNode
}

export const EmojiPickerProvider = (props: Props) => {
    const { client } = useClient()
    const onSelectedRef = useRef<((emoji: Emoji) => void) | null>(null)
    const [isOpen, setIsOpen] = useState(false)

    const [frequentEmojis, setFrequentEmojis] = useLocalStorage<Emoji[]>('emojiPicker:frequent', [])
    const [query, setQuery] = useState('')
    const [activeTab, setActiveTab] = useState(0)
    const [searchBoxFocused, setSearchBoxFocused] = useState(false)

    // OSキーボード表示時はその分だけシートを持ち上げる
    const keyboard = useKeyboard()

    const [emojiPackageList, setEmojiPackageList] = useState<List | null>(null)
    const [emojiPackageURLs, setEmojiPackageURLs] = useState<string[]>([])
    const [emojiPackages, setEmojiPackages] = useState<EmojiPackage[]>([])
    const allEmojis = useMemo(() => emojiPackages.flatMap((pkg) => pkg.emojis), [emojiPackages])

    const gridRef = useRef<HTMLDivElement>(null)

    // ---- Emoji package loading ----
    const reloadEmojiPackageURLs = useCallback(async () => {
        const list = emojiPackageList ?? (await ensureEmojiPackageList(client))
        const urls = await list.items.value()

        setEmojiPackageList(list)
        setEmojiPackageURLs(Array.from(new Set(urls)))
    }, [client, emojiPackageList])

    useEffect(() => {
        let unmounted = false

        ensureEmojiPackageList(client)
            .then(async (list) => {
                const urls = await list.items.value()

                if (unmounted) return
                setEmojiPackageList(list)
                setEmojiPackageURLs(Array.from(new Set(urls)))
            })
            .catch((e) => {
                console.error('Failed to load emoji package list:', e)
            })

        return () => {
            unmounted = true
        }
    }, [client])

    const loadEmojiPackage = useCallback(async (url: string, noCache = false): Promise<EmojiPackage | null> => {
        const cacheKey = `emojiPackage:${url}`

        if (!noCache) {
            const cache = localStorage.getItem(cacheKey)
            if (cache) {
                try {
                    return JSON.parse(cache)
                } catch {
                    localStorage.removeItem(cacheKey)
                }
            }
        }

        try {
            const res = await fetch(url, {
                cache: noCache ? 'no-cache' : 'default',
                signal: AbortSignal.timeout(5000)
            })
            const raw: RawEmojiPackage = await res.json()
            const pkg: EmojiPackage = {
                ...raw,
                packageURL: url,
                fetchedAt: new Date()
            }
            localStorage.setItem(cacheKey, JSON.stringify(pkg))
            return pkg
        } catch (e) {
            console.error('Failed to fetch emoji package:', url, e)
            return null
        }
    }, [])

    useEffect(() => {
        let unmounted = false

        Promise.all(emojiPackageURLs.map((url) => loadEmojiPackage(url))).then((packages) => {
            if (unmounted) return
            setEmojiPackages(packages.filter((pkg): pkg is EmojiPackage => pkg !== null))
        })

        return () => {
            unmounted = true
        }
    }, [emojiPackageURLs, loadEmojiPackage])

    // ---- Search ----

    const search = useCallback(
        (input: string, limit: number = 10): Emoji[] => {
            if (!input) return []
            const lower = input.toLowerCase()
            const results: Emoji[] = []
            const seen = new Set<string>()

            for (const emoji of allEmojis) {
                if (results.length >= limit) break
                const matchShortcode = emoji.shortcode.toLowerCase().includes(lower)
                const matchKeywords = emoji.keywords?.toLowerCase().includes(lower) ?? false
                if ((matchShortcode || matchKeywords) && !seen.has(emoji.imageURL)) {
                    seen.add(emoji.imageURL)
                    results.push(emoji)
                }
            }
            return results
        },
        [allEmojis]
    )

    const searchResults = useMemo(() => {
        if (query.length > 0) {
            return search(query, 64)
        }
        return []
    }, [query, search])

    // ---- Actions ----

    const open = useCallback(
        (onSelected: (emoji: Emoji) => void) => {
            onSelectedRef.current = onSelected
            setActiveTab(frequentEmojis.length > 0 ? 0 : 1)
            setQuery('')
            setIsOpen(true)
        },
        [frequentEmojis.length]
    )

    const close = useCallback(() => {
        setIsOpen(false)
        setQuery('')
        setSearchBoxFocused(false)
        onSelectedRef.current = null
    }, [])

    const addEmojiPackage = useCallback(
        async (url: string) => {
            const normalized = url.trim()
            if (!normalized || emojiPackageURLs.includes(normalized)) return

            const list = emojiPackageList ?? (await ensureEmojiPackageList(client))
            await list.addItem(client, normalized, EMOJI_PACKAGE_SCHEMA)
            await reloadEmojiPackageURLs()
        },
        [client, emojiPackageList, emojiPackageURLs, reloadEmojiPackageURLs]
    )

    const removeEmojiPackage = useCallback(
        async (url: string) => {
            const list = emojiPackageList ?? (await ensureEmojiPackageList(client))
            await list.removeItem(client, url)
            await reloadEmojiPackageURLs()
        },
        [client, emojiPackageList, reloadEmojiPackageURLs]
    )

    const updateEmojiPackage = useCallback(
        async (url: string) => {
            localStorage.removeItem(`emojiPackage:${url}`)
            const pkg = await loadEmojiPackage(url, true)

            setEmojiPackages((prev) => {
                const rest = prev.filter((item) => item.packageURL !== url)
                return pkg
                    ? [...rest, pkg].sort(
                          (a, b) => emojiPackageURLs.indexOf(a.packageURL) - emojiPackageURLs.indexOf(b.packageURL)
                      )
                    : rest
            })
        },
        [emojiPackageURLs, loadEmojiPackage]
    )

    const selectEmoji = useCallback(
        (emoji: Emoji) => {
            // よく使う絵文字を更新
            const updated = frequentEmojis.filter((e) => e.shortcode !== emoji.shortcode)
            updated.unshift(emoji)
            setFrequentEmojis(updated.slice(0, 60))

            onSelectedRef.current?.(emoji)
        },
        [frequentEmojis, setFrequentEmojis]
    )

    // ---- Display data ----

    const effectiveActiveTab = useMemo(() => {
        if (activeTab > emojiPackages.length) {
            return emojiPackages.length > 0 ? 1 : 0
        }
        return activeTab
    }, [activeTab, emojiPackages.length])

    const title = useMemo(() => {
        if (query.length > 0) return '検索結果'
        if (effectiveActiveTab === 0) return 'よく使う絵文字'
        return emojiPackages[effectiveActiveTab - 1]?.name ?? ''
    }, [query, effectiveActiveTab, emojiPackages])

    const displayEmojis = useMemo(() => {
        if (query.length > 0) return searchResults
        if (effectiveActiveTab === 0) return frequentEmojis
        return emojiPackages[effectiveActiveTab - 1]?.emojis ?? []
    }, [query, searchResults, effectiveActiveTab, frequentEmojis, emojiPackages])

    // ---- Rows for content-visibility ----

    const rows = useMemo(() => {
        const result: Emoji[][] = []
        for (let i = 0; i < displayEmojis.length; i += COLS) {
            result.push(displayEmojis.slice(i, i + COLS))
        }
        return result
    }, [displayEmojis])

    // ---- Context value ----

    const value = useMemo(
        () => ({
            open,
            close,
            search,
            packages: emojiPackages,
            packageURLs: emojiPackageURLs,
            addEmojiPackage,
            removeEmojiPackage,
            updateEmojiPackage
        }),
        [open, close, search, emojiPackages, emojiPackageURLs, addEmojiPackage, removeEmojiPackage, updateEmojiPackage]
    )

    return (
        <EmojiPickerContext.Provider value={value}>
            {props.children}

            <AnimatePresence>
                {isOpen && (
                    <>
                        {/* Backdrop */}
                        <motion.div
                            style={{
                                position: 'fixed',
                                inset: 0,
                                background: 'black',
                                zIndex: 1000
                            }}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 0.5 }}
                            exit={{ opacity: 0 }}
                            onClick={close}
                        />

                        {/* Bottom sheet */}
                        <motion.div
                            style={{
                                position: 'fixed',
                                bottom: `${keyboard.height}px`,
                                left: 0,
                                right: 0,
                                backgroundColor: CssVar.contentBackground,
                                color: CssVar.contentText,
                                borderRadius: `${CssVar.round(1)} ${CssVar.round(1)} 0 0`,
                                display: 'flex',
                                flexDirection: 'column',
                                maxHeight: '50vh',
                                paddingBottom: keyboard.visible ? 0 : 'env(safe-area-inset-bottom)',
                                transition: `bottom ${keyboard.duration}s ease-out`,
                                zIndex: 1001
                            }}
                            initial={{ y: '100%' }}
                            animate={{ y: 0 }}
                            exit={{ y: '100%' }}
                            transition={{ type: 'tween', ease: 'easeOut', duration: 0.2 }}
                            onClick={(e) => e.stopPropagation()}
                        >
                            {/* Handle */}
                            <div
                                style={{
                                    display: searchBoxFocused ? 'none' : 'flex',
                                    justifyContent: 'center',
                                    padding: `${CssVar.space(2)} 0 ${CssVar.space(1)}`
                                }}
                            >
                                <div
                                    style={{
                                        width: '30px',
                                        height: '6px',
                                        borderRadius: CssVar.round(0.5),
                                        backgroundColor: CssVar.divider
                                    }}
                                />
                            </div>

                            {/* One-line emoji strip (キーボード表示中) */}
                            <div
                                style={{
                                    display: searchBoxFocused ? 'flex' : 'none',
                                    alignItems: 'center',
                                    overflowX: 'auto',
                                    overflowY: 'hidden',
                                    padding: `${CssVar.space(1)} ${CssVar.space(2)} 0`,
                                    flexShrink: 0
                                }}
                            >
                                {displayEmojis.map((emoji, index) => (
                                    <button
                                        key={`${emoji.shortcode}-${index}`}
                                        onMouseDown={() => selectEmoji(emoji)}
                                        style={
                                            {
                                                display: 'flex',
                                                justifyContent: 'center',
                                                alignItems: 'center',
                                                border: 'none',
                                                background: 'transparent',
                                                borderRadius: CssVar.round(0.5),
                                                cursor: 'pointer',
                                                padding: '6px',
                                                flexShrink: 0,
                                                WebkitTapHighlightColor: 'transparent',
                                                contentVisibility: 'auto',
                                                containIntrinsicSize: '40px 40px'
                                            } as React.CSSProperties
                                        }
                                    >
                                        <img
                                            src={emoji.imageURL}
                                            alt={emoji.shortcode}
                                            loading="lazy"
                                            style={{
                                                width: '28px',
                                                height: '28px'
                                            }}
                                        />
                                    </button>
                                ))}
                                {displayEmojis.length === 0 && (
                                    <div
                                        style={{
                                            padding: `${CssVar.space(1)} 0`,
                                            opacity: 0.4,
                                            fontSize: '14px',
                                            whiteSpace: 'nowrap'
                                        }}
                                    >
                                        {query.length > 0 ? '一致する絵文字がありません' : '絵文字がありません'}
                                    </div>
                                )}
                            </div>

                            {/* Tabs */}
                            <div
                                style={{
                                    display: searchBoxFocused ? 'none' : 'flex',
                                    overflowX: 'auto',
                                    gap: CssVar.space(1),
                                    padding: `0 ${CssVar.space(2)}`,
                                    flexShrink: 0
                                }}
                            >
                                {/* よく使うタブ or 検索結果タブ */}
                                {query.length === 0 ? (
                                    <TabButton
                                        selected={effectiveActiveTab === 0}
                                        onClick={() => {
                                            setActiveTab(0)
                                            gridRef.current?.scrollTo(0, 0)
                                        }}
                                    >
                                        <MdAccessTime size={20} />
                                    </TabButton>
                                ) : (
                                    <TabButton selected>
                                        <MdSearch size={20} />
                                    </TabButton>
                                )}

                                {/* パッケージタブ */}
                                {emojiPackages.map((pkg, index) => (
                                    <TabButton
                                        key={pkg.packageURL}
                                        selected={query.length === 0 && effectiveActiveTab === index + 1}
                                        onClick={() => {
                                            setQuery('')
                                            setActiveTab(index + 1)
                                            gridRef.current?.scrollTo(0, 0)
                                        }}
                                    >
                                        <img
                                            src={pkg.iconURL}
                                            alt={pkg.name}
                                            style={{ width: '20px', height: '20px' }}
                                        />
                                    </TabButton>
                                ))}
                            </div>

                            {/* Divider */}
                            <div
                                style={{
                                    height: '1px',
                                    backgroundColor: CssVar.divider,
                                    margin: `${CssVar.space(1)} 0`
                                }}
                            />

                            {/* Search */}
                            <div
                                style={{
                                    padding: `0 ${CssVar.space(2)}`,
                                    flexShrink: 0
                                }}
                            >
                                <div
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: CssVar.space(1),
                                        padding: `${CssVar.space(1)} ${CssVar.space(2)}`,
                                        borderRadius: CssVar.round(0.5),
                                        backgroundColor: `rgb(from ${CssVar.contentText} r g b / 0.06)`
                                    }}
                                >
                                    <MdSearch size={18} style={{ opacity: 0.5, flexShrink: 0 }} />
                                    <input
                                        type="text"
                                        placeholder="絵文字を検索..."
                                        value={query}
                                        onChange={(e) => setQuery(e.target.value)}
                                        onFocus={() => {
                                            // キーボード表示に伴うページのスクロールずれを補正
                                            setTimeout(() => {
                                                window.scrollTo(0, 0)
                                            }, 100)
                                            setSearchBoxFocused(true)
                                        }}
                                        onBlur={() => {
                                            close()
                                        }}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter' && displayEmojis.length > 0) {
                                                e.preventDefault()
                                                selectEmoji(displayEmojis[0])
                                                close()
                                            }
                                        }}
                                        style={{
                                            flex: 1,
                                            border: 'none',
                                            outline: 'none',
                                            background: 'transparent',
                                            color: CssVar.contentText,
                                            fontSize: '14px'
                                        }}
                                    />
                                    {query.length > 0 && (
                                        // mousedownによる検索欄のblur(=close)を防いでクリアだけ行う
                                        <span onMouseDown={(e) => e.preventDefault()} style={{ display: 'flex' }}>
                                            <IconButton onClick={() => setQuery('')} style={{ padding: '2px' }}>
                                                <MdClose size={16} />
                                            </IconButton>
                                        </span>
                                    )}
                                </div>
                            </div>

                            {/* Title */}
                            <div
                                style={{
                                    display: searchBoxFocused ? 'none' : 'block',
                                    padding: `${CssVar.space(1)} ${CssVar.space(2)}`,
                                    fontSize: '12px',
                                    opacity: 0.6,
                                    flexShrink: 0
                                }}
                            >
                                {title}
                            </div>

                            {/* Emoji grid */}
                            <div
                                ref={gridRef}
                                style={{
                                    display: searchBoxFocused ? 'none' : 'block',
                                    flex: 1,
                                    overflowY: 'auto',
                                    overflowX: 'hidden',
                                    padding: `0 ${CssVar.space(2)} ${CssVar.space(2)}`,
                                    minHeight: 0
                                }}
                            >
                                {rows.length === 0 ? (
                                    <div
                                        style={{
                                            display: 'flex',
                                            justifyContent: 'center',
                                            alignItems: 'center',
                                            height: '100px',
                                            opacity: 0.4,
                                            fontSize: '14px'
                                        }}
                                    >
                                        {query.length > 0
                                            ? '一致する絵文字がありません'
                                            : activeTab === 0
                                              ? 'まだ使った絵文字がありません'
                                              : '絵文字がありません'}
                                    </div>
                                ) : (
                                    rows.map((row, rowIndex) => (
                                        <div
                                            key={rowIndex}
                                            style={
                                                {
                                                    display: 'grid',
                                                    gridTemplateColumns: `repeat(${COLS}, 1fr)`,
                                                    contentVisibility: 'auto',
                                                    containIntrinsicHeight: '44px'
                                                } as React.CSSProperties
                                            }
                                        >
                                            {row.map((emoji) => (
                                                <button
                                                    key={emoji.shortcode}
                                                    onClick={() => selectEmoji(emoji)}
                                                    style={{
                                                        display: 'flex',
                                                        justifyContent: 'center',
                                                        alignItems: 'center',
                                                        width: '100%',
                                                        aspectRatio: '1',
                                                        border: 'none',
                                                        background: 'transparent',
                                                        borderRadius: CssVar.round(0.5),
                                                        cursor: 'pointer',
                                                        padding: '4px',
                                                        WebkitTapHighlightColor: 'transparent'
                                                    }}
                                                >
                                                    <img
                                                        src={emoji.imageURL}
                                                        alt={emoji.shortcode}
                                                        loading="lazy"
                                                        style={{
                                                            width: '28px',
                                                            height: '28px'
                                                        }}
                                                    />
                                                </button>
                                            ))}
                                        </div>
                                    ))
                                )}
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </EmojiPickerContext.Provider>
    )
}

// ---- Tab button ----

const TabButton = (props: { selected?: boolean; onClick?: () => void; children: React.ReactNode }) => {
    return (
        <button
            onClick={props.onClick}
            style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: `${CssVar.space(1)} ${CssVar.space(2)}`,
                border: 'none',
                background: props.selected ? `rgb(from ${CssVar.contentText} r g b / 0.1)` : 'transparent',
                borderRadius: CssVar.round(0.5),
                cursor: 'pointer',
                color: CssVar.contentText,
                opacity: props.selected ? 1 : 0.5,
                flexShrink: 0,
                WebkitTapHighlightColor: 'transparent'
            }}
        >
            {props.children}
        </button>
    )
}

// ---- Hook ----

export const useEmojiPicker = (): EmojiPickerState => {
    const ctx = useContext(EmojiPickerContext)
    if (!ctx) {
        throw new Error('useEmojiPicker must be used within an EmojiPickerProvider')
    }
    return ctx
}
