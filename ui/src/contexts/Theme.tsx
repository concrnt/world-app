import { createContext, useContext, useLayoutEffect, useMemo } from 'react'
import { type Theme } from '../types/Theme'
import { Themes } from '../data/Themes'

interface Props {
    theme?: Theme
    themeName?: string
    children: React.ReactNode
}

const defaultTheme: Theme = {
    content: {
        text: '#000000',
        link: '#000000',
        background: '#ffffff'
    },
    ui: {
        text: '#ffffff',
        background: '#0476d9'
    },
    backdrop: {
        text: '#ffffff',
        background: '#023059'
    },
    divider: '#e6e2df',
    space: '4px',
    round: '4px',
    variant: 'world',
    meta: {
        name: 'blue'
    }
}

interface ThemeContextState {
    variant: 'classic' | 'world'
}

const ThemeContext = createContext<ThemeContextState>(defaultTheme)

export const ThemeProvider = (props: Props) => {
    const theme = useMemo(() => Themes[props.themeName] ?? props.theme ?? defaultTheme, [props.themeName, props.theme])

    useLayoutEffect(() => {
        document.documentElement.style.setProperty('--content-text', theme.content.text)
        document.documentElement.style.setProperty('--content-link', theme.content.link)
        document.documentElement.style.setProperty('--content-background', theme.content.background)
        document.documentElement.style.setProperty('--ui-text', theme.ui.text)
        document.documentElement.style.setProperty('--ui-background', theme.ui.background)
        document.documentElement.style.setProperty('--backdrop-text', theme.backdrop.text)
        document.documentElement.style.setProperty('--backdrop-background', theme.backdrop.background)
        document.documentElement.style.setProperty('--divider', theme.divider)
        document.documentElement.style.setProperty('--space', theme.space)
        document.documentElement.style.setProperty('--round', theme.round)
    }, [theme])

    const value = useMemo(() => ({ variant: theme.variant }), [theme.variant])

    return <ThemeContext.Provider value={value}>{props.children}</ThemeContext.Provider>
}

export const useTheme = () => {
    return useContext(ThemeContext)
}
