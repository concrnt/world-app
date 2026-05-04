import type { ReactNode } from 'react'
import { ThemeProvider as BaseThemeProvider } from '@concrnt/ui'
import { Themes } from '../data/themes'
import { usePreference } from './Preference'

export const ThemeProvider = (props: { children: ReactNode }) => {
    const [themeName] = usePreference('themeName')

    return <BaseThemeProvider theme={Themes[themeName] ?? Themes.blue}>{props.children}</BaseThemeProvider>
}
