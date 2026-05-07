import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { CssVar } from '../types/Theme'
import { useLocalStorage } from '../hooks/useLocalStorage'
import { MdAccessTime, MdSearch, MdClose } from 'react-icons/md'
import { IconButton } from '@concrnt/ui'

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

const TWEMOJI_URL = 'https://gist.githubusercontent.com/totegamma/6e1a047f54960f6bb7b946064664d793/raw/twemoji.json'
const COLS = 7

// ---- Context ----

export interface EmojiPickerState {
    open: (onSelected: (emoji: Emoji) => void) => void
    close: () => void
    search: (input: string, limit?: number) => Emoji[]
    packages: EmojiPackage[]
}

const EmojiPickerContext = createContext<EmojiPickerState | undefined>(undefined)

interface Props {
    children: React.ReactNode
}

export const EmojiPickerProvider = (props: Props) => {
    const onSelectedRef = useRef<((emoji: Emoji) => void) | null>(null)
    const [isOpen, setIsOpen] = useState(false)

    const [frequentEmojis, setFrequentEmojis] = useLocalStorage<Emoji[]>('emojiPicker:frequent', [])
    const [query, setQuery] = useState('')
    const [activeTab, setActiveTab] = useState(0)

    // キャッシュからの同期読み込みはuseState初期化子で行う（useEffect内の同期setStateを避ける）
    const [emojiPackages, setEmojiPackages] = useState<EmojiPackage[]>(() => {
        const pkgs: EmojiPackage[] = []
        for (const url of [TWEMOJI_URL]) {
            const cacheKey = `emojiPackage:${url}`
            const cache = localStorage.getItem(cacheKey)
            if (cache) {
                try {
                    pkgs.push(JSON.parse(cache))
                } catch {
                    localStorage.removeItem(cacheKey)
                }
            }
        }
        return pkgs
    })
    const [allEmojis, setAllEmojis] = useState<Emoji[]>(() => emojiPackages.flatMap((pkg) => pkg.emojis))

    const gridRef = useRef<HTMLDivElement>(null)

    // ---- Emoji package loading ----
    // TODO: usePreference実装後に emojiPackageURLs を設定から取得する
    const emojiPackageURLs = useMemo(() => [TWEMOJI_URL], [])

    // キャッシュにないパッケージだけネットワークから取得
    useEffect(() => {
        let unmounted = false

        emojiPackageURLs.forEach((url) => {
            const cacheKey = `emojiPackage:${url}`
            // キャッシュ済みならuseState初期化子で読み込み済み → スキップ
            if (localStorage.getItem(cacheKey)) return

            fetch(url, { signal: AbortSignal.timeout(5000) })
                .then((res) => res.json())
                .then((raw: RawEmojiPackage) => {
                    const pkg: EmojiPackage = {
                        ...raw,
                        packageURL: url,
                        fetchedAt: new Date()
                    }
                    if (!unmounted) {
                        setEmojiPackages((prev) => [...prev, pkg])
                        setAllEmojis((prev) => [...prev, ...pkg.emojis])
                        localStorage.setItem(cacheKey, JSON.stringify(pkg))
                    }
                })
                .catch((e) => {
                    console.error('Failed to fetch emoji package:', url, e)
                })
        })

        return () => {
            unmounted = true
        }
    }, [emojiPackageURLs])

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
        onSelectedRef.current = null
    }, [])

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

    const title = useMemo(() => {
        if (query.length > 0) return '検索結果'
        if (activeTab === 0) return 'よく使う絵文字'
        return emojiPackages[activeTab - 1]?.name ?? ''
    }, [query, activeTab, emojiPackages])

    const displayEmojis = useMemo(() => {
        if (query.length > 0) return searchResults
        if (activeTab === 0) return frequentEmojis
        return emojiPackages[activeTab - 1]?.emojis ?? []
    }, [query, searchResults, activeTab, frequentEmojis, emojiPackages])

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
            packages: emojiPackages
        }),
        [open, close, search, emojiPackages]
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
                                bottom: 0,
                                left: 0,
                                right: 0,
                                backgroundColor: CssVar.contentBackground,
                                color: CssVar.contentText,
                                borderRadius: `${CssVar.round(1)} ${CssVar.round(1)} 0 0`,
                                display: 'flex',
                                flexDirection: 'column',
                                maxHeight: '50vh',
                                paddingBottom: 'env(safe-area-inset-bottom)',
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
                                    display: 'flex',
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

                            {/* Tabs */}
                            <div
                                style={{
                                    display: 'flex',
                                    overflowX: 'auto',
                                    gap: CssVar.space(1),
                                    padding: `0 ${CssVar.space(2)}`,
                                    flexShrink: 0
                                }}
                            >
                                {/* よく使うタブ or 検索結果タブ */}
                                {query.length === 0 ? (
                                    <TabButton
                                        selected={activeTab === 0}
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
                                        selected={query.length === 0 && activeTab === index + 1}
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
                                        <IconButton onClick={() => setQuery('')} style={{ padding: '2px' }}>
                                            <MdClose size={16} />
                                        </IconButton>
                                    )}
                                </div>
                            </div>

                            {/* Title */}
                            <div
                                style={{
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
