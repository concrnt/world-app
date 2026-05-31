import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { Theme } from '../types/Theme'
import { usePreference } from './Preference'
import { Themes } from '../data/themes'
import { ThemeProvider as BaseThemeProvider } from '@concrnt/ui'
import { useClient } from './Client'
import {
    deleteCustomTheme as deleteCustomThemeDocument,
    loadCustomThemes,
    saveCustomTheme as saveCustomThemeDocument
} from '../utils/themeList'

interface Props {
    theme?: Theme
    children: React.ReactNode
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
    const [themeName] = usePreference('themeName')
    const [customThemes, setCustomThemes] = useState<Record<string, Theme>>({})
    const theme = props.theme ?? customThemes[themeName] ?? Themes[themeName] ?? Themes.blue

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
            <BaseThemeProvider theme={theme}>{props.children}</BaseThemeProvider>
        </ThemeLibraryContext.Provider>
    )
}

export const useThemeLibrary = (): ThemeLibraryState => {
    return useContext(ThemeLibraryContext)
}
