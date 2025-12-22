import { createContext, useContext } from 'react'
import { Theme } from '../types/Theme'

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
    }
}

const ThemeContext = createContext<Theme>(defaultTheme)

export const ThemeProvider = (props: Props) => {
    return <ThemeContext.Provider value={props.theme ?? defaultTheme}>{props.children}</ThemeContext.Provider>
}

export const useTheme = () => {
    return useContext(ThemeContext)
}
