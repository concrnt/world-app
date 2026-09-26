import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AnimatePresence, motion, useAnimate } from 'motion/react'
import { CssVar } from '../types/Theme'
import { usePersistent } from '../hooks/usePersistent'
import { MdAccessTime, MdSearch, MdClose } from 'react-icons/md'
import { FaEthereum } from 'react-icons/fa6'
import { useNavigate } from 'react-router-dom'
import { Button, CCImage, CircularProgress, HorizontalLayout, IconButton, Popover, Text, Tooltip, useAnchor, CfmActionsProvider, useCfmActions } from '@concrnt/ui'
import { useClient } from './Client'
import { useHaptics } from './Haptics'
import { Aurora } from '../components/Aurora'
import { SpeedLines } from '../components/SpeedLines'
import styles from './EmojiPicker.module.css'
import { EMOJI_PACKAGE_SCHEMA, ensureEmojiPackageList } from '../utils/emojiPackages'
import type { List, ListEntry } from '@concrnt/worldlib'
import { useKeyboard } from './Keyboard'
import { useMediaProxy } from './MediaProxy'
import { useIsMobile } from '../hooks/useIsMobile'

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

// デスクトップの中央ダイアログ(380px)は8列、モバイルのボトムシートはapp版と同じ10列
const COLS_DESKTOP = 8
const COLS_MOBILE = 10

const SUPER_TIP_AMOUNTS = [
    { eth: '0.00024', yen: '100円' },
    { eth: '0.0024', yen: '1,000円' },
    { eth: '0.012', yen: '5,000円' },
    { eth: '0.024', yen: '10,000円' }
]

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
    // anchor: 開いたボタン側が useAnchor() で宣言したアンカー名(デスクトップでボタンの右下に出す。省略時は画面中央)
    open: (onSelected: (emoji: Emoji, superEth?: string) => void, anchor?: string) => void
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
    const onSelectedRef = useRef<((emoji: Emoji, superEth?: string) => void) | null>(null)
    const [isOpen, setIsOpen] = useState(false)

    const keyboard = useKeyboard()
    const { getImageURL } = useMediaProxy()
    const [aspectTick, setAspectTick] = useState(0)
    const isMobile = useIsMobile()
    const navigate = useNavigate()

    const [frequentEmojis, setFrequentEmojis] = usePersistent<Emoji[]>('emojiPicker:frequent', [])
    const [query, setQuery] = useState('')
    const [activeTab, setActiveTab] = useState(0)
    // モバイルのみ: 検索欄フォーカス中(=キーボード表示中)は横一列ストリップ表示に切り替える
    const [searchBoxFocused, setSearchBoxFocused] = useState(false)
    const [sheetExpanded, setSheetExpanded] = useState(false)
    const [sheetDragHeight, setSheetDragHeight] = useState<number | null>(null)
    const [superReactionEnabled, setSuperReactionEnabled] = useState(false)
    const [superReactionTipOpen, setSuperReactionTipOpen] = useState(false)
    const superReactionAnchor = useAnchor()
    const superReactionTipTimer = useRef<number | undefined>(undefined)
    const superReactionTipVisible = useRef(false)
    const [superDraft, setSuperDraft] = useState<{ emoji: Emoji; fromX: number; fromY: number } | null>(null)
    const [superAmount, setSuperAmount] = useState<string | null>(null)
    const [holdProgress, setHoldProgress] = useState(0)
    const { hapticHeavy } = useHaptics()
    const hapticHeavyRef = useRef(hapticHeavy)
    hapticHeavyRef.current = hapticHeavy
    const holdFrame = useRef<number | undefined>(undefined)
    const holdStartedAt = useRef<number | null>(null)
    const holdLastHaptic = useRef(0)
    const holdSent = useRef(false)
    const txTimer = useRef<number | undefined>(undefined)
    const [txActive, setTxActive] = useState(false)
    const [iconScope, animateIcon] = useAnimate()
    const [settleScope, animateSettle] = useAnimate()
    const superDraftRef = useRef(superDraft)
    const superAmountRef = useRef(superAmount)
    superDraftRef.current = superDraft
    superAmountRef.current = superAmount
    const sheetRef = useRef<HTMLDivElement>(null)
    const sheetDrag = useRef<{
        pointerId: number
        startY: number
        startHeight: number
        minHeight: number
        maxHeight: number
        height: number
    } | null>(null)
    const searchDragPending = useRef<{ pointerId: number; startY: number } | null>(null)
    // デスクトップのみ: ホバー中の絵文字を下部フッターにプレビュー表示する
    const [hoveredEmoji, setHoveredEmoji] = useState<Emoji | null>(null)
    // デスクトップのみ: 開いたボタンのアンカー名(nullなら画面中央にフォールバック)
    const [anchorName, setAnchorName] = useState<string | null>(null)

    const [emojiPackageList, setEmojiPackageList] = useState<List | null>(null)
    const [emojiPackageURLs, setEmojiPackageURLs] = useState<string[]>([])
    const [packageEntries, setPackageEntries] = useState<ListEntry[]>([])
    const [emojiPackages, setEmojiPackages] = useState<EmojiPackage[]>([])
    const allEmojis = useMemo(() => emojiPackages.flatMap((pkg) => pkg.emojis), [emojiPackages])

    const gridRef = useRef<HTMLDivElement>(null)
    const searchInputRef = useRef<HTMLInputElement>(null)

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
        (onSelected: (emoji: Emoji) => void, anchor?: string) => {
            onSelectedRef.current = onSelected
            setActiveTab(frequentEmojis.length > 0 ? 0 : 1)
            setQuery('')
            setSheetExpanded(false)
            setSheetDragHeight(null)
            setSuperReactionEnabled(false)
            setSuperReactionTipOpen(false)
            setSuperDraft(null)
            setSuperAmount(null)
            superReactionTipVisible.current = false
            window.clearTimeout(superReactionTipTimer.current)
            setAnchorName(anchor ?? null)
            setIsOpen(true)
            // モバイルでは検索欄を自動フォーカスしない。キーボードはユーザーのタップで出す
            if (!isMobile) {
                setTimeout(() => searchInputRef.current?.focus(), 100)
            }
        },
        [frequentEmojis.length, isMobile]
    )

    const close = useCallback(() => {
        setIsOpen(false)
        setQuery('')
        setSearchBoxFocused(false)
        setSheetExpanded(false)
        setSheetDragHeight(null)
        setSuperReactionEnabled(false)
        setSuperReactionTipOpen(false)
        setSuperDraft(null)
        setSuperAmount(null)
        superReactionTipVisible.current = false
        window.clearTimeout(superReactionTipTimer.current)
        setHoveredEmoji(null)
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
        (emoji: Emoji, superEth?: string) => {
            const updated = frequentEmojis.filter((e) => e.shortcode !== emoji.shortcode)
            updated.unshift(emoji)
            setFrequentEmojis(updated.slice(0, 60))

            onSelectedRef.current?.(emoji, superEth)
        },
        [frequentEmojis, setFrequentEmojis]
    )

    const beginSuperDraft = (emoji: Emoji, origin: HTMLElement | null): void => {
        const from = origin?.getBoundingClientRect()
        const sheet = sheetRef.current?.getBoundingClientRect()
        const fromX = from && sheet ? from.left + from.width / 2 - (sheet.left + sheet.width / 2) : 0
        const fromY = from && sheet ? from.top + from.height / 2 - (sheet.top + sheet.height * 0.34) : 0
        setSuperDraft({ emoji, fromX, fromY })
        setSuperAmount(null)
        setSheetExpanded(true)
        setSheetDragHeight(null)
        searchInputRef.current?.blur()
    }

    const endHold = (send: boolean): void => {
        if (holdFrame.current !== undefined) cancelAnimationFrame(holdFrame.current)
        holdFrame.current = undefined
        holdStartedAt.current = null
        setHoldProgress(0)
        if (!send || holdSent.current) return
        const draft = superDraftRef.current
        const amount = superAmountRef.current
        if (!draft || amount === null) return
        holdSent.current = true
        window.clearTimeout(txTimer.current)
        setTxActive(true)
        const txMs = Math.min(30000, Math.max(10000, 20000 + (Math.random() + Math.random() + Math.random() - 1.5) * 12000))
        txTimer.current = window.setTimeout(() => {
            txTimer.current = undefined
            const current = superDraftRef.current
            const amount = superAmountRef.current
            if (!current || amount === null) return
            selectEmoji(current.emoji, amount)
            close()
        }, txMs)
    }

    const tickHold = (): void => {
        const started = holdStartedAt.current
        if (started === null) return
        const now = performance.now()
        const progress = Math.min(1, (now - started) / 5000)
        if (progress >= 2 / 3 && progress < 1) {
            const shake = (progress - 2 / 3) / (1 / 3)
            const gap = 110 - shake * 65
            if (now - holdLastHaptic.current >= gap) {
                holdLastHaptic.current = now
                hapticHeavyRef.current()
            }
        }
        setHoldProgress(progress)
        if (progress >= 1) {
            endHold(true)
            return
        }
        holdFrame.current = requestAnimationFrame(tickHold)
    }

    useEffect(() => {
        return () => {
            if (holdFrame.current !== undefined) cancelAnimationFrame(holdFrame.current)
            window.clearTimeout(txTimer.current)
        }
    }, [])

    useEffect(() => {
        if (superDraft) return
        if (holdFrame.current !== undefined) cancelAnimationFrame(holdFrame.current)
        holdFrame.current = undefined
        holdStartedAt.current = null
        holdSent.current = false
        window.clearTimeout(txTimer.current)
        txTimer.current = undefined
        setTxActive(false)
        setHoldProgress(0)
    }, [superDraft])

    useEffect(() => {
        const icon = iconScope.current
        const settle = settleScope.current
        if (!icon || !settle || !superDraft) return
        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

        const playbacks: { stop: () => void }[] = []
        if (!txActive) {
            playbacks.push(
                animateIcon(
                    icon,
                    {
                        x: [0, 12, -14, 8, 0],
                        y: [0, -14, 6, 12, 0],
                        rotate: [-6, 5, 8, -4, -6]
                    },
                    { duration: 9, ease: 'easeInOut', repeat: Infinity }
                )
            )
            return () => {
                for (const playback of playbacks) playback.stop()
            }
        }

        const raw = getComputedStyle(icon).transform
        const flat = raw.match(/^matrix\(([^)]+)\)$/)
        const deep = raw.match(/^matrix3d\(([^)]+)\)$/)
        const parts = (flat?.[1] ?? deep?.[1])?.split(',').map((part) => Number(part))
        const x = parts ? (flat ? parts[4] : parts[12]) : 0
        const y = parts ? (flat ? parts[5] : parts[13]) : 0
        const rotate = parts ? (Math.atan2(parts[1], parts[0]) * 180) / Math.PI : 0
        playbacks.push(
            animateSettle(
                settle,
                { x: [x, 0], y: [y, 0], rotate: [rotate, 0] },
                { duration: 0.2, ease: [0.15, 0.9, 0.25, 1.2] }
            ),
            animateIcon(
                icon,
                {
                    x: [0, -4, 4, -2, 0],
                    y: [0, 2, -2, -3, 0],
                    rotate: [0, -1.4, 1.2, -0.7, 0]
                },
                { duration: 0.08, ease: 'linear', repeat: Infinity }
            )
        )
        return () => {
            for (const playback of playbacks) playback.stop()
        }
    }, [txActive, superDraft, animateIcon, animateSettle, iconScope, settleScope])

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

    const cols = isMobile ? COLS_MOBILE : COLS_DESKTOP

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
                    if (columnSpan(ratio, cols) > 1) changed = true
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
    }, [displayEmojis, getImageURL, cols])

    const rows = useMemo(() => {
        return packEmojiRows(displayEmojis, cols)
    }, [displayEmojis, cols, aspectTick])

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
            setHoveredEmoji(null)
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

    const holdLabel =
        holdProgress <= 0
            ? 'ホールドで送信'
            : holdProgress < 1 / 3
              ? 'そのまま...'
              : holdProgress < 2 / 3
                ? 'もう少し...'
                : 'あとちょっと...!'
    const holdShake = holdProgress < 2 / 3 ? 0 : (holdProgress - 2 / 3) / (1 / 3)
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    let holdShift: string | undefined
    if (holdShake > 0 && !reduceMotion) {
        const now = performance.now()
        const amp = 0.8 + holdShake * 3.4
        const freq = 0.045 + holdShake * 0.112
        const x = Math.sin(now * freq) * amp
        const y = Math.cos(now * freq * 1.37) * amp * 0.45
        holdShift = `translate3d(${x.toFixed(2)}px, ${y.toFixed(2)}px, 0)`
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
                {isOpen && isMobile && (
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

                        {/* Bottom sheet (app版ミラー): キーボードの上に持ち上がる */}
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
                            <AnimatePresence>
                                {superReactionEnabled && (
                                    <motion.div
                                        key="aurora"
                                        style={{
                                            position: 'absolute',
                                            inset: 0,
                                            zIndex: -1,
                                            pointerEvents: 'none',
                                            overflow: 'hidden',
                                            borderRadius: `${CssVar.round(1)} ${CssVar.round(1)} 0 0`
                                        }}
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 0.4 }}
                                        exit={{ opacity: 0 }}
                                        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                                    >
                                        <Aurora />
                                    </motion.div>
                                )}
                                {txActive && (
                                    <motion.div
                                        key="speed"
                                        style={{
                                            position: 'absolute',
                                            inset: 0,
                                            zIndex: -1,
                                            pointerEvents: 'none',
                                            overflow: 'hidden',
                                            borderRadius: `${CssVar.round(1)} ${CssVar.round(1)} 0 0`
                                        }}
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 0.08 }}
                                        exit={{ opacity: 0 }}
                                        transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
                                    >
                                        <SpeedLines />
                                    </motion.div>
                                )}
                            </AnimatePresence>
                            {superDraft && (
                                <div
                                    style={{
                                        flex: 1,
                                        minHeight: 0,
                                        display: 'flex',
                                        flexDirection: 'column',
                                        padding: `${CssVar.space(2)} ${CssVar.space(3)} ${CssVar.space(4)}`
                                    }}
                                >
                                    <div
                                        style={{
                                            position: 'relative',
                                            flex: 1,
                                            minHeight: 0,
                                            display: 'flex',
                                            flexDirection: 'column',
                                            alignItems: 'center',
                                            justifyContent: 'center'
                                        }}
                                    >
                                        {!txActive && (
                                        <button
                                            type="button"
                                            onClick={() => {
                                                if (holdFrame.current !== undefined) {
                                                    cancelAnimationFrame(holdFrame.current)
                                                }
                                                holdFrame.current = undefined
                                                holdStartedAt.current = null
                                                holdSent.current = false
                                                window.clearTimeout(txTimer.current)
                                                txTimer.current = undefined
                                                setTxActive(false)
                                                setHoldProgress(0)
                                                setSuperDraft(null)
                                                setSuperAmount(null)
                                            }}
                                            style={{
                                                position: 'absolute',
                                                top: 0,
                                                left: 0,
                                                zIndex: 1,
                                                border: 'none',
                                                background: 'transparent',
                                                color: CssVar.contentText,
                                                fontSize: '16px',
                                                lineHeight: '24px',
                                                padding: `${CssVar.space(1)} 0`,
                                                cursor: 'pointer',
                                                WebkitTapHighlightColor: 'transparent'
                                            }}
                                        >
                                            キャンセル
                                        </button>
                                        )}
                                        <div style={{ position: 'relative' }}>
                                            <motion.div
                                                initial={{
                                                    x: superDraft.fromX,
                                                    y: superDraft.fromY,
                                                    scale: 0.35,
                                                    opacity: 0.4
                                                }}
                                                animate={{ x: 0, y: 0, scale: 1, opacity: 1 }}
                                                transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
                                            >
                                                <div ref={settleScope}>
                                                    <div
                                                        ref={iconScope}
                                                    style={{
                                                        width: '50vw',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center'
                                                    }}
                                                >
                                                    <CCImage
                                                        src={superDraft.emoji.imageURL}
                                                        maxHeight={1024}
                                                        alt={superDraft.emoji.shortcode}
                                                        style={{
                                                            width: '50vw',
                                                            height: 'auto',
                                                            maxHeight: '50vw'
                                                        }}
                                                    />
                                                </div>
                                                </div>
                                            </motion.div>
                                        </div>
                                    </div>
                                        <motion.div
                                            initial={{ opacity: 0, y: 10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            transition={{ delay: 0.25, duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                                            style={{
                                                position: 'relative',
                                                flexShrink: 0,
                                                visibility: txActive ? 'hidden' : 'visible',
                                                pointerEvents: txActive ? 'none' : 'auto'
                                            }}
                                        >
                                            {txActive && (
                                                <div
                                                    style={{
                                                        visibility: 'visible',
                                                        position: 'absolute',
                                                        zIndex: 1,
                                                        top: 0,
                                                        right: `calc(${CssVar.space(3)} * -1)`,
                                                        bottom: keyboard.visible
                                                            ? `calc(${CssVar.space(4)} * -1)`
                                                            : `calc(${CssVar.space(4)} * -1 - env(safe-area-inset-bottom))`,
                                                        left: `calc(${CssVar.space(3)} * -1)`,
                                                        paddingBottom: keyboard.visible ? 0 : 'env(safe-area-inset-bottom)',
                                                        backgroundColor: CssVar.contentBackground,
                                                        color: CssVar.contentText,
                                                        display: 'flex',
                                                        flexDirection: 'column',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        gap: CssVar.space(4),
                                                        pointerEvents: 'none'
                                                    }}
                                                >
                                                    <div
                                                        style={{
                                                            fontSize: '15px',
                                                            lineHeight: '22px',
                                                            fontWeight: 700
                                                        }}
                                                    >
                                                        トランザクションが進行中
                                                    </div>
                                                    <div
                                                        style={{
                                                            display: 'flex',
                                                            flexDirection: 'column',
                                                            alignItems: 'center',
                                                            gap: CssVar.space(2)
                                                        }}
                                                    >
                                                        <div
                                                            style={{
                                                                position: 'relative',
                                                                width: 72,
                                                                height: 72,
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                justifyContent: 'center'
                                                            }}
                                                        >
                                                            <CircularProgress size={72} />
                                                            <div
                                                                style={{
                                                                    position: 'absolute',
                                                                    inset: 0,
                                                                    display: 'flex',
                                                                    alignItems: 'center',
                                                                    justifyContent: 'center'
                                                                }}
                                                            >
                                                                <FaEthereum size={28} />
                                                            </div>
                                                        </div>
                                                        {superAmount !== null && (
                                                            <div
                                                                style={{
                                                                    fontSize: '16px',
                                                                    lineHeight: '22px',
                                                                    fontWeight: 700
                                                                }}
                                                            >
                                                                {superAmount} ETH
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            )}
                                        <div
                                            style={{
                                                fontSize: '13px',
                                                lineHeight: '18px',
                                                fontWeight: 700,
                                                opacity: 0.6,
                                                marginBottom: CssVar.space(2)
                                            }}
                                        >
                                            チップ額を選択
                                        </div>
                                        <div
                                            style={{
                                                display: 'flex',
                                                flexDirection: 'column',
                                                gap: CssVar.space(2)
                                            }}
                                        >
                                            {SUPER_TIP_AMOUNTS.map((amount) => {
                                                const selected = superAmount === amount.eth
                                                return (
                                                    <button
                                                        key={amount.eth}
                                                        type="button"
                                                        aria-pressed={selected}
                                                        onClick={() => setSuperAmount(amount.eth)}
                                                        style={
                                                            {
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                gap: CssVar.space(2),
                                                                width: '100%',
                                                                minHeight: '48px',
                                                                padding: `0 ${CssVar.space(3)}`,
                                                                border: 'none',
                                                                borderRadius: CssVar.round(0.5),
                                                                cursor: 'pointer',
                                                                backgroundColor: selected
                                                                    ? CssVar.uiBackground
                                                                    : `rgb(from ${CssVar.contentText} r g b / 0.06)`,
                                                                color: selected ? CssVar.uiText : CssVar.contentText,
                                                                WebkitTapHighlightColor: 'transparent'
                                                            } as React.CSSProperties
                                                        }
                                                    >
                                                        <FaEthereum size={18} />
                                                        <span
                                                            style={{
                                                                flex: 1,
                                                                textAlign: 'left',
                                                                fontSize: '16px',
                                                                fontWeight: 700
                                                            }}
                                                        >
                                                            {amount.eth}
                                                        </span>
                                                        <span
                                                            style={{
                                                                fontSize: '14px',
                                                                opacity: selected ? 0.85 : 0.55
                                                            }}
                                                        >
                                                            {amount.yen}
                                                        </span>
                                                    </button>
                                                )
                                            })}
                                        </div>
                                        <button
                                            type="button"
                                            disabled={superAmount === null}
                                            onContextMenu={(event) => {
                                                event.preventDefault()
                                            }}
                                            onPointerDown={(event) => {
                                                if (event.button !== 0 || superAmount === null) return
                                                event.currentTarget.setPointerCapture(event.pointerId)
                                                if (holdFrame.current !== undefined) {
                                                    cancelAnimationFrame(holdFrame.current)
                                                }
                                                holdSent.current = false
                                                holdLastHaptic.current = 0
                                                holdStartedAt.current = performance.now()
                                                setHoldProgress(0.001)
                                                holdFrame.current = requestAnimationFrame(tickHold)
                                            }}
                                            onPointerUp={() => {
                                                if (holdStartedAt.current === null) return
                                                const progress = Math.min(
                                                    1,
                                                    (performance.now() - holdStartedAt.current) / 5000
                                                )
                                                endHold(progress >= 1)
                                            }}
                                            onPointerCancel={() => {
                                                endHold(false)
                                            }}
                                            style={{
                                                position: 'relative',
                                                overflow: 'hidden',
                                                width: '100%',
                                                minHeight: '48px',
                                                marginTop: CssVar.space(3),
                                                padding: `${CssVar.space(1)} ${CssVar.space(2)}`,
                                                border: 'none',
                                                borderRadius: CssVar.round(1),
                                                backgroundColor: CssVar.uiBackground,
                                                color: CssVar.uiText,
                                                fontSize: '1.2rem',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                cursor: superAmount === null ? 'default' : 'pointer',
                                                opacity: superAmount === null ? 0.45 : 1,
                                                touchAction: 'none',
                                                userSelect: 'none',
                                                WebkitTouchCallout: 'none',
                                                WebkitTapHighlightColor: 'transparent',
                                                textShadow: '0 1px 2px rgba(0, 0, 0, 0.45)',
                                                transform: holdShift
                                            }}
                                        >
                                            <span
                                                style={{
                                                    position: 'absolute',
                                                    left: 0,
                                                    top: 0,
                                                    bottom: 0,
                                                    width: `${Math.min(holdProgress, 1) * 100}%`,
                                                    backgroundColor: `color-mix(in srgb, white 46%, ${CssVar.uiBackground})`,
                                                    pointerEvents: 'none'
                                                }}
                                            />
                                            <span style={{ position: 'relative' }}>{holdLabel}</span>
                                        </button>
                                        </motion.div>
                                </div>
                            )}
                            {/* Handle */}
                            <div
                                onPointerDown={onHandlePointerDown}
                                onPointerMove={onHandlePointerMove}
                                onPointerUp={onHandlePointerUp}
                                onPointerCancel={onHandlePointerUp}
                                style={{
                                    display: superDraft ? 'none' : 'flex',
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
                                    display: superDraft ? 'none' : 'flex',
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
                                                if (superReactionEnabled) {
                                                    beginSuperDraft(displayEmojis[0], null)
                                                    return
                                                }
                                                selectEmoji(displayEmojis[0])
                                                close()
                                            }
                                        }}
                                        className={superReactionEnabled ? styles.searchInput : undefined}
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
                                    display: superDraft ? 'none' : searchBoxFocused ? 'flex' : 'none',
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
                                    display: superDraft || searchBoxFocused ? 'none' : 'flex',
                                    gap: CssVar.space(1),
                                    padding: `${CssVar.space(1)} ${CssVar.space(3)}`,
                                    flexShrink: 0
                                }}
                            >
                                {query.length === 0 ? (
                                    <TabButton
                                        selected={effectiveActiveTab === 0}
                                        onClick={() => {
                                            setActiveTab(0)
                                            setHoveredEmoji(null)
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

                                {emojiPackages.map((pkg, index) => (
                                    <TabButton
                                        key={pkg.packageURL}
                                        selected={query.length === 0 && effectiveActiveTab === index + 1}
                                        onClick={() => {
                                            setQuery('')
                                            setActiveTab(index + 1)
                                            setHoveredEmoji(null)
                                            gridRef.current?.scrollTo(0, 0)
                                        }}
                                    >
                                        <CCImage
                                            src={pkg.iconURL}
                                            maxHeight={128}
                                            style={{ width: '22px', height: '22px' }}
                                        />
                                    </TabButton>
                                ))}
                            </HorizontalLayout>

                            {/* Divider */}
                            <div
                                style={{
                                    display: superDraft ? 'none' : 'block',
                                    height: '1px',
                                    backgroundColor: CssVar.divider,
                                    margin: `${CssVar.space(2)} 0`
                                }}
                            />

                            {/* Emoji grid。見出しはリストの先頭に置き、スクロールで一緒に流す */}
                            <div
                                ref={gridRef}
                                style={{
                                    display: superDraft ? 'none' : searchBoxFocused ? 'none' : 'block',
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
                                            : effectiveActiveTab === 0
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
                                                    gridTemplateColumns: `repeat(${cols}, 1fr)`,
                                                    contentVisibility: 'auto',
                                                    containIntrinsicHeight: '44px'
                                                } as React.CSSProperties
                                            }
                                        >
                                            {row.map(({ emoji, span }) => (
                                                <button
                                                    key={emoji.shortcode}
                                                    onPointerDown={(e) => {
                                                        e.currentTarget.dataset.press = `${e.clientX},${e.clientY}`
                                                    }}
                                                    onPointerUp={(e) => {
                                                        if (e.button !== 0) return
                                                        const start = e.currentTarget.dataset.press
                                                        if (start) {
                                                            const [x, y] = start.split(',').map(Number)
                                                            if (Math.hypot(e.clientX - x, e.clientY - y) > 10) return
                                                        }
                                                        if (superReactionEnabled) {
                                                            beginSuperDraft(emoji, e.currentTarget)
                                                            return
                                                        }
                                                        selectEmoji(emoji)
                                                        searchInputRef.current?.blur()
                                                    }}
                                                    onClick={(e) => {
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

                            {/* キーボードの裏まで背景を敷くスペーサ */}
                            <div
                                style={{
                                    display: superDraft ? 'none' : 'block',
                                    flexShrink: 0,
                                    height: `${keyboard.height}px`,
                                    transition: `height ${keyboard.duration}s cubic-bezier(0.22, 1, 0.36, 1)`
                                }}
                            />
                        </motion.div>
                    </>
                )}
            </AnimatePresence>

            {/* デスクトップ: 開いたボタン(アンカー)の右下に出すPopover。アンカー未指定時は画面中央 */}
            {!isMobile && (
                <Popover
                    open={isOpen}
                    onClose={close}
                    anchor={anchorName ?? '--emoji-picker-unanchored'}
                    style={{
                        width: '380px',
                        maxWidth: '90vw',
                        height: '480px',
                        maxHeight: '90vh',
                        overflow: 'hidden',
                        padding: 0,
                        borderRadius: CssVar.round(2),
                        // アンカーが無いときはanchor()が解決できずtop/leftが無効になるため、明示的に画面中央へ
                        ...(anchorName ? {} : { top: 'calc(50% - 240px)', left: 'calc(50% - 190px)' })
                    }}
                >
                    {isOpen && (
                        <div
                            style={{
                                display: 'flex',
                                flexDirection: 'column',
                                height: '100%',
                                overflow: 'hidden'
                            }}
                        >
                            {/* Tabs */}
                            <HorizontalLayout
                                style={{
                                    gap: CssVar.space(1),
                                    padding: `${CssVar.space(2)} ${CssVar.space(2)} 0`,
                                    flexShrink: 0
                                }}
                            >
                                {query.length === 0 ? (
                                    <TabButton
                                        selected={effectiveActiveTab === 0}
                                        onClick={() => {
                                            setActiveTab(0)
                                            setHoveredEmoji(null)
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

                                {emojiPackages.map((pkg, index) => (
                                    <TabButton
                                        key={pkg.packageURL}
                                        selected={query.length === 0 && effectiveActiveTab === index + 1}
                                        onClick={() => {
                                            setQuery('')
                                            setActiveTab(index + 1)
                                            setHoveredEmoji(null)
                                            gridRef.current?.scrollTo(0, 0)
                                        }}
                                    >
                                        <CCImage
                                            src={pkg.iconURL}
                                            maxHeight={128}
                                            alt={pkg.name}
                                            style={{ width: '20px', height: '20px' }}
                                        />
                                    </TabButton>
                                ))}
                            </HorizontalLayout>

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
                                        ref={searchInputRef}
                                        type="text"
                                        placeholder={t('searchPlaceholder')}
                                        value={query}
                                        onChange={(e) => {
                                            setQuery(e.target.value)
                                            setHoveredEmoji(null)
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
                                            ? t('noMatchingEmojis')
                                            : effectiveActiveTab === 0
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
                                                    gridTemplateColumns: `repeat(${cols}, 1fr)`,
                                                    contentVisibility: 'auto',
                                                    containIntrinsicHeight: '44px'
                                                } as React.CSSProperties
                                            }
                                        >
                                            {row.map(({ emoji, span }) => (
                                                <button
                                                    key={emoji.shortcode}
                                                    onClick={() => selectEmoji(emoji)}
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
                                                    onMouseOver={(e) => {
                                                        ;(e.currentTarget as HTMLElement).style.backgroundColor =
                                                            `rgb(from ${CssVar.contentText} r g b / 0.1)`
                                                        setHoveredEmoji(emoji)
                                                    }}
                                                    onMouseOut={(e) => {
                                                        ;(e.currentTarget as HTMLElement).style.backgroundColor =
                                                            'transparent'
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

                            {/* Divider */}
                            <div
                                style={{
                                    height: '1px',
                                    backgroundColor: CssVar.divider,
                                    flexShrink: 0
                                }}
                            />

                            {/* Hover preview + add emojis */}
                            <div
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    gap: CssVar.space(1),
                                    padding: `${CssVar.space(1)} ${CssVar.space(2)}`,
                                    height: '52px',
                                    flexShrink: 0
                                }}
                            >
                                <div
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: CssVar.space(1),
                                        minWidth: 0
                                    }}
                                >
                                    {hoveredEmoji && (
                                        <>
                                            <CCImage
                                                src={hoveredEmoji.imageURL}
                                                maxHeight={128}
                                                alt={hoveredEmoji.shortcode}
                                                style={{
                                                    width: '28px',
                                                    height: '28px',
                                                    flexShrink: 0
                                                }}
                                            />
                                            <span
                                                style={{
                                                    fontSize: '12px',
                                                    opacity: 0.6,
                                                    overflow: 'hidden',
                                                    textOverflow: 'ellipsis',
                                                    whiteSpace: 'nowrap'
                                                }}
                                            >
                                                :{hoveredEmoji.shortcode}:
                                            </span>
                                        </>
                                    )}
                                </div>
                                <Button
                                    variant="outlined"
                                    onClick={() => {
                                        close()
                                        navigate('/settings/emoji')
                                    }}
                                    style={{ flexShrink: 0 }}
                                >
                                    {t('addEmojis')}
                                </Button>
                            </div>
                        </div>
                    )}
                </Popover>
            )}
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
