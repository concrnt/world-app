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

    return <BaseThemeProvider theme={props.theme ?? Themes[themeName]}>{props.children}</BaseThemeProvider>
}
