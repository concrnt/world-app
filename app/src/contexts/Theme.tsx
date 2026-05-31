import { Theme } from '../types/Theme'
import { usePreference } from './Preference'
import { Themes } from '../data/themes'
import { ThemeProvider as BaseThemeProvider } from '@concrnt/ui'

interface Props {
    theme?: Theme
    children: React.ReactNode
}

export const ThemeProvider = (props: Props) => {
    const [themeName] = usePreference('themeName')
    const [customThemes] = usePreference('customThemes')
    const theme = props.theme ?? customThemes[themeName] ?? Themes[themeName] ?? Themes.blue

    return <BaseThemeProvider theme={theme}>{props.children}</BaseThemeProvider>
}
