import { createContext, ReactNode, useContext } from 'react'

// web にはハプティクスが無いため全て no-op（app 版とインターフェースを揃えるためのミラー）
interface HapticsState {
    hapticLight: () => void
    hapticSuccess: () => void
    hapticSelection: () => void
    hapticHeavy: () => void
}

const HapticsContext = createContext<HapticsState>({
    hapticLight: () => {},
    hapticSuccess: () => {},
    hapticSelection: () => {},
    hapticHeavy: () => {}
})

interface HapticsProviderProps {
    children: ReactNode
}

export const HapticsProvider = (props: HapticsProviderProps): ReactNode => {
    return <>{props.children}</>
}

export function useHaptics(): HapticsState {
    return useContext(HapticsContext)
}
