import { createContext, useContext, useEffect } from 'react'
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
    },
    divider: '#e6e2df'
}

const ThemeContext = createContext<Theme>(defaultTheme)

export const ThemeProvider = (props: Props) => {
    const theme = props.theme ?? defaultTheme

    useEffect(() => {
        //document.body.style.backgroundColor = theme.ui.background
    }, [theme])

    return <ThemeContext.Provider value={theme}>{props.children}</ThemeContext.Provider>
}

export const useTheme = () => {
    return useContext(ThemeContext)
}
