import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { Theme } from '../types/Theme'
import { usePreference, type Preference } from './Preference'
import { usePersistent } from '../hooks/usePersistent'
import { Themes } from '../data/themes'
import { ThemeProvider as BaseThemeProvider, CfmActionsProvider, migrateTheme } from '@concrnt/ui'
import { useClient } from './Client'
import {
    deleteCustomTheme as deleteCustomThemeDocument,
    loadCustomThemes,
    saveCustomTheme as saveCustomThemeDocument
} from '../utils/themeList'
import { CCUserChip } from '../components/CCUserChip'
import { TimelineChip } from '../components/TimelineChip'
import { useNavigate } from 'react-router-dom'

interface Props {
    theme?: Theme
    children: React.ReactNode
}

// 前回解決されたテーマのlocalStorageキャッシュ。ThemeProviderが解決のたびに書き、
// client構築前(CachedThemeProvider)とカスタムテーマの非同期ロード完了までのつなぎ
// (ThemeProvider自身のフォールバック)が読む
const CACHED_THEME_KEY = 'cachedTheme'

// clientなしで前回のテーマを適用する軽量版Provider。起動時ローディングなど
// ThemeProviderの外側で使う。キャッシュ未生成時(初回起動)はpreferenceの
// テーマ名をビルトインから引き、それも無ければblue
export const CachedThemeProvider = (props: { children: React.ReactNode }) => {
    const [cachedPref] = usePersistent<Preference>('preference')
    const [cachedTheme] = usePersistent<Theme>(CACHED_THEME_KEY)
    return (
        <BaseThemeProvider theme={cachedTheme ?? Themes[cachedPref?.themeName ?? ''] ?? Themes.blue}>
            {props.children}
        </BaseThemeProvider>
    )
}

interface ThemeLibraryState {
    customThemes: Record<string, Theme>
    reloadThemes: () => Promise<void>
    saveTheme: (theme: Theme) => Promise<Theme>
    deleteTheme: (title: string) => Promise<void>
}

const ThemeLibraryContext = createContext<ThemeLibraryState>({
    customThemes: {},
    reloadThemes: async () => {},
    saveTheme: async (theme) => theme,
    deleteTheme: async () => {}
})

export const ThemeProvider = (props: Props) => {
    const { client } = useClient()
    const [themeName, setThemeName] = usePreference('themeName')
    const [customThemes, setCustomThemes] = useState<Record<string, Theme>>({})
    // カスタムテーマはロード完了までcustomThemesに入らないため、その間は前回キャッシュで
    // つなぐ(blueに落とすとローディング画面からの切替時に一瞬デフォルトテーマがチラつく)
    const [cachedTheme] = usePersistent<Theme>(CACHED_THEME_KEY)
    const theme = props.theme ?? customThemes[themeName] ?? Themes[themeName] ?? cachedTheme ?? Themes.blue

    // 解決できたテーマをキャッシュする。カスタムテーマはロード完了前は解決できないため、
    // 未解決のままblueを書き込まないよう条件付き
    useEffect(() => {
        const resolved = customThemes[themeName] ?? Themes[themeName]
        if (resolved) localStorage.setItem(CACHED_THEME_KEY, JSON.stringify(resolved))
    }, [customThemes, themeName])

    const reloadThemes = useCallback(async () => {
        const themes = await loadCustomThemes(client)
        setCustomThemes(themes)
    }, [client])

    useEffect(() => {
        let unmounted = false

        loadCustomThemes(client)
            .then((themes) => {
                if (unmounted) return
                setCustomThemes(themes)
            })
            .catch((e) => {
                console.error('Failed to load custom themes', e)
            })

        return () => {
            unmounted = true
        }
    }, [client])

    const saveTheme = useCallback(
        async (theme: Theme) => {
            const saved = await saveCustomThemeDocument(client, theme)
            const name = saved.meta?.name
            if (name) {
                setCustomThemes((prev) => ({
                    ...prev,
                    [name]: saved
                }))
            }
            return saved
        },
        [client]
    )

    const deleteTheme = useCallback(
        async (title: string) => {
            await deleteCustomThemeDocument(client, title)
            setCustomThemes((prev) => {
                const next = { ...prev }
                delete next[title]
                return next
            })
        },
        [client]
    )

    const importTheme = useCallback(
        async (source: Theme) => {
            const saved = await saveTheme(migrateTheme(source))
            if (saved.meta?.name) {
                setThemeName(saved.meta.name)
            }
        },
        [saveTheme, setThemeName]
    )

    const navigate = useNavigate()

    // concrnt.worldオリジンの共有URLは外部ブラウザに出さず内部ルートで開く
    const openInternal = useCallback(
        (url: string): boolean => {
            let parsed: URL
            try {
                parsed = new URL(url)
            } catch {
                return false
            }
            if (parsed.hostname !== 'concrnt.world') return false
            const path = parsed.pathname
            const isInternal =
                /^\/(post|timeline)\/[^/]+$/.test(path) ||
                /^\/profile\/[^/]+(\/[^/]+)?$/.test(path) ||
                /^\/activitypub\/(person|note|view)\/[^/]+$/.test(path) ||
                /^\/bluesky\/(person|post|view)\/[^/]+$/.test(path)
            if (!isInternal) return false
            navigate(path + parsed.search + parsed.hash)
            return true
        },
        [navigate]
    )

    const value = useMemo(
        () => ({
            customThemes,
            reloadThemes,
            saveTheme,
            deleteTheme
        }),
        [customThemes, reloadThemes, saveTheme, deleteTheme]
    )

    return (
        <ThemeLibraryContext.Provider value={value}>
            <CfmActionsProvider
                value={{
                    importTheme,
                    renderUserChip: (ccid) => (
                        <CCUserChip ccid={ccid} style={{ display: 'inline-flex', verticalAlign: 'middle' }} />
                    ),
                    renderTimelineChip: (fqid) => (
                        <TimelineChip fqid={fqid} style={{ display: 'inline-flex', verticalAlign: 'middle' }} />
                    ),
                    openInternal
                }}
            >
                <BaseThemeProvider theme={theme}>{props.children}</BaseThemeProvider>
            </CfmActionsProvider>
        </ThemeLibraryContext.Provider>
    )
}

export const useThemeLibrary = (): ThemeLibraryState => {
    return useContext(ThemeLibraryContext)
}
