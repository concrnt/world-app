import { createContext, ReactNode, useContext, useMemo } from 'react'
import { impactFeedback, notificationFeedback, selectionFeedback } from '@tauri-apps/plugin-haptics'
import { usePreference } from './Preference'

interface HapticsState {
    /** 軽いタップフィードバック（ファボ、リアクションなど） */
    hapticLight: () => void
    /** 成功フィードバック（投稿完了、リプライ完了など） */
    hapticSuccess: () => void
    /** セレクションフィードバック（PTR の閾値超えなど） */
    hapticSelection: () => void
}

const HapticsContext = createContext<HapticsState>({
    hapticLight: () => {},
    hapticSuccess: () => {},
    hapticSelection: () => {}
})

interface HapticsProviderProps {
    children: ReactNode
}

export const HapticsProvider = (props: HapticsProviderProps): ReactNode => {
    const [enabled] = usePreference('hapticsEnabled')

    const value = useMemo<HapticsState>(
        () => ({
            hapticLight: () => {
                if (!enabled) return
                impactFeedback('light').catch(() => {})
            },
            hapticSuccess: () => {
                if (!enabled) return
                notificationFeedback('success').catch(() => {})
            },
            hapticSelection: () => {
                if (!enabled) return
                selectionFeedback().catch(() => {})
            }
        }),
        [enabled]
    )

    return <HapticsContext.Provider value={value}>{props.children}</HapticsContext.Provider>
}

export function useHaptics(): HapticsState {
    return useContext(HapticsContext)
}
