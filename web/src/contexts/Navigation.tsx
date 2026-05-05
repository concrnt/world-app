import { createContext, ReactNode, useContext, useMemo } from 'react'

interface NavigationContextState {
    backNode?: ReactNode
}

interface Props {
    backNode?: ReactNode
    children: React.ReactNode
}

const NavigationContext = createContext<NavigationContextState>({
    backNode: undefined
})

export const NavigationProvider = (props: Props) => {
    const value = useMemo(
        () => ({
            backNode: props.backNode
        }),
        [props]
    )

    return <NavigationContext.Provider value={value}>{props.children}</NavigationContext.Provider>
}

export const useNavigation = () => {
    return useContext(NavigationContext)
}
