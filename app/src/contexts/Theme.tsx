import { createContext, useContext, useEffect, useMemo } from 'react'
import { Theme } from '../types/Theme'
import { usePreference } from './Preference'
import { Themes } from '../data/themes'

interface Props {
    theme?: Theme
    children: React.ReactNode
}

const defaultTheme: Theme = {
    content: {
        text: '#292e24',
        link: '#265E2C',
        background: '#fffcfa'
    },
    ui: {
        text: '#ffffff',
        background: '#292e24'
    },
    backdrop: {
        text: '#292e24',
        background: '#12a129'
    },
    divider: '#e6e2df',
    variant: 'classic',
    space: '4px',
    round: '8px'
}

interface ThemeContextState {
    variant: 'classic' | 'world'
}

const ThemeContext = createContext<ThemeContextState>({
    variant: 'classic'
})

export const ThemeProvider = (props: Props) => {
    const [themeName] = usePreference('themeName')

    const theme = useMemo(() => Themes[themeName] ?? props.theme ?? defaultTheme, [themeName, props.theme])

    useEffect(() => {
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
