import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AnimatePresence, motion } from 'motion/react'
import { CssVar } from '../types/Theme'
import { usePersistent } from '../hooks/usePersistent'
import { MdAccessTime, MdSearch, MdClose } from 'react-icons/md'
import { CCImage, HorizontalLayout, IconButton, CfmActionsProvider, useCfmActions, Popover, Text, Tooltip, useAnchor } from '@concrnt/ui'
import { useClient } from './Client'
import { useKeyboard } from './Keyboard'
import { useMediaProxy } from './MediaProxy'
import { EMOJI_PACKAGE_SCHEMA, ensureEmojiPackageList } from '../utils/emojiPackages'
import type { List, ListEntry } from '@concrnt/worldlib'

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

const COLS = 10

// ほぼ正方形はそのまま1マス。横長は縦横比を四捨五入した列数を取る。
const columnSpan = (ratio: number | undefined, cols: number): number => {
    if (ratio === undefined || !Number.isFinite(ratio) || ratio < 1.35) return 1
    return Math.min(cols, Math.max(2, Math.round(ratio)))
}

const emojiAspectCache = new Map<string, number>()

const packEmojiRows = (emojis: Emoji[], cols: number): { emoji: Emoji; span: number }[][] => {
    const pending = emojis.map((emoji) => ({
        emoji,
        span: columnSpan(emojiAspectCache.get(emoji.imageURL), cols)
    }))
    const rows: { emoji: Emoji; span: number }[][] = []
    while (pending.length > 0) {
        const row: { emoji: Emoji; span: number }[] = []
        let used = 0
        let index = 0
        // 入りきらない横長は飛ばし、後ろの短い絵文字で行の余りを埋める
        while (index < pending.length && used < cols) {
            const cell = pending[index]
            if (used + cell.span <= cols) {
                row.push(cell)
                used += cell.span
                pending.splice(index, 1)
            } else {
                index += 1
            }
        }
        if (row.length === 0) {
            const cell = pending.shift()
            if (!cell) break
            cell.span = Math.min(cell.span, cols)
            row.push(cell)
        }
        rows.push(row)
    }
    return rows
}

// ---- Context ----

export interface EmojiPickerState {
    open: (onSelected: (emoji: Emoji) => void) => void
    close: () => void
    search: (input: string, limit?: number) => Emoji[]
    packages: EmojiPackage[]
    packageURLs: string[]
    packageEntries: ListEntry[]
    addEmojiPackage: (url: string) => Promise<void>
    removeEmojiPackage: (key: string) => Promise<void>
    updateEmojiPackage: (url: string) => Promise<void>
}

const EmojiPickerContext = createContext<EmojiPickerState | undefined>(undefined)

interface Props {
    children: React.ReactNode
}

export const EmojiPickerProvider = (props: Props) => {
    const { t } = useTranslation('', { keyPrefix: 'contexts.emojiPicker' })
    const { client } = useClient()
    const parentCfmActions = useCfmActions()
    const onSelectedRef = useRef<((emoji: Emoji) => void) | null>(null)
    const [isOpen, setIsOpen] = useState(false)

    const [frequentEmojis, setFrequentEmojis] = usePersistent<Emoji[]>('emojiPicker:frequent', [])
    const [query, setQuery] = useState('')
    const [activeTab, setActiveTab] = useState(0)
    const [searchBoxFocused, setSearchBoxFocused] = useState(false)
    const [sheetExpanded, setSheetExpanded] = useState(false)
    const [sheetDragHeight, setSheetDragHeight] = useState<number | null>(null)
    const [superReactionEnabled, setSuperReactionEnabled] = useState(false)
    const [superReactionTipOpen, setSuperReactionTipOpen] = useState(false)
    const superReactionAnchor = useAnchor()
    const superReactionTipTimer = useRef<number | undefined>(undefined)
    const superReactionTipVisible = useRef(false)
    const sheetRef = useRef<HTMLDivElement>(null)
    const searchInputRef = useRef<HTMLInputElement>(null)
    const sheetDrag = useRef<{
        pointerId: number
        startY: number
        startHeight: number
        minHeight: number
        maxHeight: number
        height: number
    } | null>(null)
    const searchDragPending = useRef<{ pointerId: number; startY: number } | null>(null)

    // OSキーボード表示時はその分だけシートを持ち上げる
    const keyboard = useKeyboard()
    const { getImageURL } = useMediaProxy()
    const [aspectTick, setAspectTick] = useState(0)

    const [emojiPackageList, setEmojiPackageList] = useState<List | null>(null)
    const [emojiPackageURLs, setEmojiPackageURLs] = useState<string[]>([])
    const [packageEntries, setPackageEntries] = useState<ListEntry[]>([])
    const [emojiPackages, setEmojiPackages] = useState<EmojiPackage[]>([])
    const allEmojis = useMemo(() => emojiPackages.flatMap((pkg) => pkg.emojis), [emojiPackages])

    const gridRef = useRef<HTMLDivElement>(null)

    // ---- Emoji package loading ----
    const reloadEmojiPackageURLs = useCallback(async () => {
        const list = emojiPackageList ?? (await ensureEmojiPackageList(client))
        const entries = await list.entries.value()
        const urls = entries.map((e) => e.value?.href).filter((h): h is string => typeof h === 'string' && !!h)

        setEmojiPackageList(list)
        setPackageEntries(entries)
        setEmojiPackageURLs(Array.from(new Set(urls)))
    }, [client, emojiPackageList])

    useEffect(() => {
        let unmounted = false

        ensureEmojiPackageList(client)
            .then(async (list) => {
                const entries = await list.entries.value()
                const urls = entries.map((e) => e.value?.href).filter((h): h is string => typeof h === 'string' && !!h)

                if (unmounted) return
                setEmojiPackageList(list)
                setPackageEntries(entries)
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
            setSheetExpanded(false)
            setSheetDragHeight(null)
            setSuperReactionEnabled(false)
            setSuperReactionTipOpen(false)
            superReactionTipVisible.current = false
            window.clearTimeout(superReactionTipTimer.current)
            setIsOpen(true)
        },
        [frequentEmojis.length]
    )

    const close = useCallback(() => {
        setIsOpen(false)
        setQuery('')
        setSearchBoxFocused(false)
        setSheetExpanded(false)
        setSheetDragHeight(null)
        setSuperReactionEnabled(false)
        setSuperReactionTipOpen(false)
        superReactionTipVisible.current = false
        window.clearTimeout(superReactionTipTimer.current)
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
        async (key: string) => {
            const list = emojiPackageList ?? (await ensureEmojiPackageList(client))
            await client.api.delete(key)
            list.items.reload()
            list.entries.reload()
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
        if (query.length > 0) return t('searchResults')
        if (effectiveActiveTab === 0) return t('frequentlyUsed')
        return emojiPackages[effectiveActiveTab - 1]?.name ?? ''
    }, [query, effectiveActiveTab, emojiPackages, t])

    const displayEmojis = useMemo(() => {
        if (query.length > 0) return searchResults
        if (effectiveActiveTab === 0) return frequentEmojis
        return emojiPackages[effectiveActiveTab - 1]?.emojis ?? []
    }, [query, searchResults, effectiveActiveTab, frequentEmojis, emojiPackages])

    // 横長絵文字の列数は画像の縦横比から決める。測り終わったら詰め直す
    useEffect(() => {
        const unseen = new Set<string>()
        for (const emoji of displayEmojis) {
            if (!emojiAspectCache.has(emoji.imageURL)) unseen.add(emoji.imageURL)
        }
        if (unseen.size === 0) return

        let cancelled = false
        let started = false
        let left = unseen.size
        let changed = false
        const flush = () => {
            if (!started || left > 0 || !changed || cancelled) return
            setAspectTick((n) => n + 1)
        }
        for (const url of unseen) {
            const img = new Image()
            const finish = () => {
                if (!cancelled && img.naturalWidth > 0 && img.naturalHeight > 0) {
                    const ratio = img.naturalWidth / img.naturalHeight
                    emojiAspectCache.set(url, ratio)
                    if (columnSpan(ratio, COLS) > 1) changed = true
                } else if (!cancelled) {
                    emojiAspectCache.set(url, 1)
                }
                left -= 1
                flush()
            }
            img.onload = finish
            img.onerror = finish
            img.src = getImageURL(url, { maxHeight: 128 })
        }
        started = true
        flush()
        return () => {
            cancelled = true
        }
    }, [displayEmojis, getImageURL])

    // ---- Rows for content-visibility ----

    const rows = useMemo(() => {
        return packEmojiRows(displayEmojis, COLS)
        // aspectTick はキャッシュ更新の再計算用
    }, [displayEmojis, aspectTick])

    // ---- Context value ----

    const value = useMemo(
        () => ({
            open,
            close,
            search,
            packages: emojiPackages,
            packageURLs: emojiPackageURLs,
            packageEntries,
            addEmojiPackage,
            removeEmojiPackage,
            updateEmojiPackage
        }),
        [
            open,
            close,
            search,
            emojiPackages,
            emojiPackageURLs,
            packageEntries,
            addEmojiPackage,
            removeEmojiPackage,
            updateEmojiPackage
        ]
    )

    const readSafeTop = (): number => {
        const probe = document.createElement('div')
        probe.style.paddingTop = 'env(safe-area-inset-top)'
        document.body.appendChild(probe)
        const top = parseFloat(getComputedStyle(probe).paddingTop) || 0
        probe.remove()
        return top
    }

    const onHandlePointerDown = (event: React.PointerEvent<HTMLDivElement>): void => {
        if (event.button !== 0) return
        const sheet = sheetRef.current
        if (!sheet) return
        const startHeight = sheet.getBoundingClientRect().height
        const maxHeight = window.innerHeight - readSafeTop()
        event.currentTarget.setPointerCapture(event.pointerId)
        sheetDrag.current = {
            pointerId: event.pointerId,
            startY: event.clientY,
            startHeight,
            minHeight: 0,
            maxHeight,
            height: startHeight
        }
        setSheetDragHeight(startHeight)
    }

    const onHandlePointerMove = (event: React.PointerEvent<HTMLDivElement>): void => {
        const drag = sheetDrag.current
        if (!drag || drag.pointerId !== event.pointerId) return
        const next = Math.min(drag.maxHeight, Math.max(0, drag.startHeight + (drag.startY - event.clientY)))
        drag.height = next
        setSheetDragHeight(next)
    }

    const onHandlePointerUp = (event: React.PointerEvent<HTMLDivElement>): void => {
        const drag = sheetDrag.current
        if (!drag || drag.pointerId !== event.pointerId) return
        sheetDrag.current = null
        const half = window.innerHeight * 0.5
        if (drag.height < half - 80) {
            setIsOpen(false)
            setQuery('')
            setSearchBoxFocused(false)
            setSheetExpanded(false)
            onSelectedRef.current = null
            return
        }
        setSheetExpanded(drag.height > (half + drag.maxHeight) / 2)
        setSheetDragHeight(null)
    }

    const onSearchPointerDown = (event: React.PointerEvent<HTMLDivElement>): void => {
        if (event.button !== 0) return
        searchDragPending.current = { pointerId: event.pointerId, startY: event.clientY }
    }

    const onSearchPointerMove = (event: React.PointerEvent<HTMLDivElement>): void => {
        const pending = searchDragPending.current
        if (pending && pending.pointerId === event.pointerId && !sheetDrag.current) {
            if (Math.abs(event.clientY - pending.startY) < 8) return
            searchDragPending.current = null
            const sheet = sheetRef.current
            if (!sheet) return
            const startHeight = sheet.getBoundingClientRect().height
            const maxHeight = window.innerHeight - readSafeTop()
            event.currentTarget.setPointerCapture(event.pointerId)
            sheetDrag.current = {
                pointerId: event.pointerId,
                startY: event.clientY,
                startHeight,
                minHeight: 0,
                maxHeight,
                height: startHeight
            }
            setSheetDragHeight(startHeight)
            return
        }
        onHandlePointerMove(event)
    }

    const onSearchPointerUp = (event: React.PointerEvent<HTMLDivElement>): void => {
        searchDragPending.current = null
        onHandlePointerUp(event)
    }

    const dismissKeyboard = (event: { target: EventTarget | null }): void => {
        const input = searchInputRef.current
        if (!input || document.activeElement !== input) return
        const box = input.parentElement
        if (box && event.target instanceof Node && box.contains(event.target)) return
        input.blur()
    }

    const sheetHeight =
        sheetDragHeight !== null
            ? `${sheetDragHeight}px`
            : sheetExpanded
              ? 'calc(100vh - env(safe-area-inset-top))'
              : '50vh'

    return (
        <EmojiPickerContext.Provider value={value}>
            <CfmActionsProvider
                value={{
                    ...parentCfmActions,
                    loadEmojipack: loadEmojiPackage,
                    addEmojipack: addEmojiPackage,
                    emojipackURLs: emojiPackageURLs
                }}
            >
                {props.children}
            </CfmActionsProvider>

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
                            ref={sheetRef}
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
                                height: sheetHeight,
                                paddingBottom: keyboard.visible ? 0 : 'env(safe-area-inset-bottom)',
                                // ドラッグ中は指に追従。離したあととキーボード追従だけアニメーションする
                                transition:
                                    sheetDragHeight !== null
                                        ? 'none'
                                        : `height ${keyboard.duration > 0 ? keyboard.duration : 0.32}s cubic-bezier(0.22, 1, 0.36, 1)`,
                                zIndex: 1001
                            }}
                            initial={{ y: '100%' }}
                            animate={{ y: 0 }}
                            exit={{ y: '100%' }}
                            transition={{ type: 'tween', ease: [0.22, 1, 0.36, 1], duration: 0.15 }}
                            onClick={(e) => {
                                e.stopPropagation()
                                dismissKeyboard(e)
                            }}
                        >
                            {superReactionEnabled && (
                                <div
                                    style={{
                                        pointerEvents: 'none',
                                        position: 'absolute',
                                        inset: 0,
                                        borderRadius: `${CssVar.round(1)} ${CssVar.round(1)} 0 0`,
                                        background: [
                                            `linear-gradient(to bottom, ${CssVar.uiBackground}, rgb(from ${CssVar.uiBackground} r g b / 0) 48px)`,
                                            `linear-gradient(to top, ${CssVar.uiBackground}, rgb(from ${CssVar.uiBackground} r g b / 0) 48px)`,
                                            `linear-gradient(to right, ${CssVar.uiBackground}, rgb(from ${CssVar.uiBackground} r g b / 0) 48px)`,
                                            `linear-gradient(to left, ${CssVar.uiBackground}, rgb(from ${CssVar.uiBackground} r g b / 0) 48px)`
                                        ].join(', '),
                                        zIndex: 2
                                    }}
                                />
                            )}
                            {/* Handle */}
                            <div
                                onPointerDown={onHandlePointerDown}
                                onPointerMove={onHandlePointerMove}
                                onPointerUp={onHandlePointerUp}
                                onPointerCancel={onHandlePointerUp}
                                style={{
                                    display: 'flex',
                                    justifyContent: 'center',
                                    padding: `${CssVar.space(3)} 0 ${CssVar.space(2)}`,
                                    touchAction: 'none',
                                    cursor: 'grab',
                                    flexShrink: 0
                                }}
                            >
                                <div
                                    style={{
                                        width: '36px',
                                        height: '5px',
                                        borderRadius: CssVar.round(0.5),
                                        backgroundColor: CssVar.divider
                                    }}
                                />
                            </div>

                            {/* Search: カテゴリアイコン列の上。ここを上下に動かしてもシートサイズが変わる */}
                            <div
                                onPointerDown={onSearchPointerDown}
                                onPointerMove={onSearchPointerMove}
                                onPointerUp={onSearchPointerUp}
                                onPointerCancel={onSearchPointerUp}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: CssVar.space(2),
                                    padding: searchBoxFocused
                                        ? `${CssVar.space(3)} ${CssVar.space(3)} 0`
                                        : `${CssVar.space(1)} ${CssVar.space(3)} ${CssVar.space(3)}`,
                                    flexShrink: 0,
                                    touchAction: 'none',
                                    cursor: 'grab'
                                }}
                            >
                                <div
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: CssVar.space(2),
                                        flex: 1,
                                        minWidth: 0,
                                        minHeight: '44px',
                                        padding: `0 ${CssVar.space(3)}`,
                                        borderRadius: CssVar.round(0.5),
                                        backgroundColor: `rgb(from ${CssVar.contentText} r g b / 0.06)`
                                    }}
                                >
                                    <MdSearch size={22} style={{ opacity: 0.5, flexShrink: 0 }} />
                                    <input
                                        ref={searchInputRef}
                                        type="text"
                                        placeholder={t('searchPlaceholder')}
                                        value={query}
                                        onChange={(e) => setQuery(e.target.value)}
                                        onFocus={() => {
                                            setSheetDragHeight(null)
                                            setSheetExpanded(true)
                                            // キーボード表示に伴うページのスクロールずれを補正
                                            setTimeout(() => {
                                                window.scrollTo(0, 0)
                                            }, 100)
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
                                            fontSize: '16px',
                                            lineHeight: '24px',
                                            cursor: 'text'
                                        }}
                                    />
                                    {query.length > 0 && (
                                        // mousedownによる検索欄のblur(=close)を防いでクリアだけ行う
                                        <span onMouseDown={(e) => e.preventDefault()} style={{ display: 'flex' }}>
                                            <IconButton
                                                onClick={() => setQuery('')}
                                                style={{ width: '28px', height: '28px', padding: 0 }}
                                            >
                                                <MdClose size={18} />
                                            </IconButton>
                                        </span>
                                    )}
                                </div>
                                <Tooltip
                                    content={
                                        <Text style={{ whiteSpace: 'nowrap', wordBreak: 'keep-all' }}>
                                            {t('enableSuperReaction')}
                                        </Text>
                                    }
                                    style={{
                                        whiteSpace: 'nowrap',
                                        width: 'max-content',
                                        maxWidth: 'none',
                                        justifySelf: 'start'
                                    }}
                                >
                                    <button
                                        type="button"
                                        aria-pressed={superReactionEnabled}
                                        aria-label={t('enableSuperReaction')}
                                        onPointerDown={(e) => {
                                            e.stopPropagation()
                                            if (window.matchMedia('(hover: hover) and (pointer: fine)').matches) return
                                            window.clearTimeout(superReactionTipTimer.current)
                                            superReactionTipVisible.current = true
                                            setSuperReactionTipOpen(true)
                                        }}
                                        onPointerUp={(e) => {
                                            e.stopPropagation()
                                            if (!superReactionTipVisible.current) return
                                            window.clearTimeout(superReactionTipTimer.current)
                                            superReactionTipTimer.current = window.setTimeout(() => {
                                                superReactionTipVisible.current = false
                                                setSuperReactionTipOpen(false)
                                            }, 1200)
                                        }}
                                        onPointerCancel={(e) => {
                                            e.stopPropagation()
                                            window.clearTimeout(superReactionTipTimer.current)
                                            superReactionTipVisible.current = false
                                            setSuperReactionTipOpen(false)
                                        }}
                                        onClick={() => setSuperReactionEnabled((enabled) => !enabled)}
                                        style={
                                            {
                                                width: '44px',
                                                height: '44px',
                                                flexShrink: 0,
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                border: 'none',
                                                borderRadius: CssVar.round(0.5),
                                                padding: 0,
                                                cursor: 'pointer',
                                                anchorName: superReactionAnchor,
                                                color: superReactionEnabled ? CssVar.uiText : CssVar.contentText,
                                                backgroundColor: superReactionEnabled
                                                    ? CssVar.uiBackground
                                                    : `rgb(from ${CssVar.contentText} r g b / 0.06)`,
                                                WebkitTapHighlightColor: 'transparent'
                                            } as React.CSSProperties
                                        }
                                    >
                                        <svg
                                            xmlns="http://www.w3.org/2000/svg"
                                            width="24"
                                            height="24"
                                            viewBox="0 0 24 24"
                                            fill="none"
                                            stroke="currentColor"
                                            strokeWidth="2"
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            aria-hidden
                                        >
                                            <path d="M13.267 2.08a10 10 0 1 0 8.653 8.653" />
                                            <path d="M15 10V9" />
                                            <path d="M16 5h6" />
                                            <path d="M16.472 15a6 6 0 0 1 -8.943 0" />
                                            <path d="M19 2v6" />
                                            <path d="M9 10V9" />
                                        </svg>
                                    </button>
                                </Tooltip>
                                <Popover
                                    open={superReactionTipOpen}
                                    onClose={() => {
                                        superReactionTipVisible.current = false
                                        setSuperReactionTipOpen(false)
                                    }}
                                    anchor={superReactionAnchor}
                                    mode="manual"
                                    style={{
                                        top: 'auto',
                                        bottom: `calc(anchor(top) + ${CssVar.space(1)})`,
                                        pointerEvents: 'none',
                                        whiteSpace: 'nowrap',
                                        width: 'max-content',
                                        maxWidth: 'none',
                                        justifySelf: 'start'
                                    }}
                                >
                                    <Text style={{ whiteSpace: 'nowrap', wordBreak: 'keep-all' }}>
                                        {t('enableSuperReaction')}
                                    </Text>
                                </Popover>
                            </div>

                            {/* One-line emoji strip (キーボード表示中) */}
                            <HorizontalLayout
                                style={{
                                    display: searchBoxFocused ? 'flex' : 'none',
                                    alignItems: 'center',
                                    overflowY: 'hidden',
                                    boxSizing: 'border-box',
                                    height: '48px',
                                    minHeight: '48px',
                                    padding: `0 ${CssVar.space(3)}`,
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
                                                width: '48px',
                                                height: '48px',
                                                padding: 0,
                                                flexShrink: 0,
                                                WebkitTapHighlightColor: 'transparent',
                                                contentVisibility: 'auto',
                                                containIntrinsicSize: '48px 48px'
                                            } as React.CSSProperties
                                        }
                                    >
                                        <CCImage
                                            src={emoji.imageURL}
                                            maxHeight={128}
                                            alt={emoji.shortcode}
                                            loading="lazy"
                                            style={{
                                                width: '32px',
                                                height: '32px'
                                            }}
                                        />
                                    </button>
                                ))}
                                {displayEmojis.length === 0 && (
                                    <div
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            height: '48px',
                                            opacity: 0.4,
                                            fontSize: '16px',
                                            lineHeight: '24px',
                                            whiteSpace: 'nowrap'
                                        }}
                                    >
                                        {query.length > 0 ? t('noMatchingEmojis') : t('noEmojis')}
                                    </div>
                                )}
                            </HorizontalLayout>

                            {/* Tabs */}
                            <HorizontalLayout
                                style={{
                                    display: searchBoxFocused ? 'none' : 'flex',
                                    gap: CssVar.space(1),
                                    padding: `${CssVar.space(1)} ${CssVar.space(3)}`,
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
                                        <MdAccessTime size={22} />
                                    </TabButton>
                                ) : (
                                    <TabButton selected>
                                        <MdSearch size={22} />
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
                                        <CCImage
                                            src={pkg.iconURL}
                                            maxHeight={128}
                                            alt={pkg.name}
                                            style={{ width: '22px', height: '22px' }}
                                        />
                                    </TabButton>
                                ))}
                            </HorizontalLayout>

                            {/* Divider */}
                            <div
                                style={{
                                    height: '1px',
                                    backgroundColor: CssVar.divider,
                                    margin: `${CssVar.space(2)} 0`
                                }}
                            />

                            {/* Emoji grid。見出しはリストの先頭に置き、スクロールで一緒に流す */}
                            <div
                                ref={gridRef}
                                style={{
                                    display: searchBoxFocused ? 'none' : 'block',
                                    flex: 1,
                                    overflowY: 'auto',
                                    overflowX: 'hidden',
                                    padding: `0 ${CssVar.space(3)} ${CssVar.space(3)}`,
                                    minHeight: 0
                                }}
                            >
                                <div
                                    style={{
                                        // タブアイコンの左端(行の space(3) + ボタンの space(1))に揃える
                                        padding: `${CssVar.space(1)} 0 ${CssVar.space(2)} ${CssVar.space(1)}`,
                                        fontSize: '13px',
                                        lineHeight: '18px',
                                        fontWeight: 700,
                                        opacity: 0.6
                                    }}
                                >
                                    {title}
                                </div>
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
                                            ? t('noMatchingEmojis')
                                            : activeTab === 0
                                              ? t('noRecentEmojis')
                                              : t('noEmojis')}
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
                                            {row.map(({ emoji, span }) => (
                                                <button
                                                    key={emoji.shortcode}
                                                    onPointerUp={(e) => {
                                                        if (e.button !== 0) return
                                                        const start = e.currentTarget.dataset.press
                                                        if (start) {
                                                            const [x, y] = start.split(',').map(Number)
                                                            if (Math.hypot(e.clientX - x, e.clientY - y) > 10) return
                                                        }
                                                        selectEmoji(emoji)
                                                        searchInputRef.current?.blur()
                                                    }}
                                                    onPointerDown={(e) => {
                                                        e.currentTarget.dataset.press = `${e.clientX},${e.clientY}`
                                                    }}
                                                    onClick={(e) => {
                                                        // pointerupで既に選んでいる。clickの二重挿入を防ぐ
                                                        e.preventDefault()
                                                    }}
                                                    style={{
                                                        display: 'flex',
                                                        justifyContent: 'center',
                                                        alignItems: 'center',
                                                        width: '100%',
                                                        gridColumn: span > 1 ? `span ${span}` : undefined,
                                                        aspectRatio: `${span} / 1`,
                                                        border: 'none',
                                                        background: 'transparent',
                                                        borderRadius: CssVar.round(0.5),
                                                        cursor: 'pointer',
                                                        padding: '4px',
                                                        WebkitTapHighlightColor: 'transparent'
                                                    }}
                                                >
                                                    <CCImage
                                                        src={emoji.imageURL}
                                                        maxHeight={128}
                                                        alt={emoji.shortcode}
                                                        loading="lazy"
                                                        style={{
                                                            width: 'auto',
                                                            height: 'auto',
                                                            maxWidth: '100%',
                                                            maxHeight: '28px'
                                                        }}
                                                    />
                                                </button>
                                            ))}
                                        </div>
                                    ))
                                )}
                            </div>

                            {/* キーボードの裏まで背景を敷くスペーサ。アクセサリービューが無いため隙間分も足す */}
                            <div
                                style={{
                                    flexShrink: 0,
                                    height: `calc(${keyboard.height}px + ${keyboard.visible ? CssVar.space(2) : '0px'})`,
                                    transition: `height ${keyboard.duration}s cubic-bezier(0.22, 1, 0.36, 1)`
                                }}
                            />
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
                minWidth: '36px',
                minHeight: '36px',
                padding: `${CssVar.space(1)}`,
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
