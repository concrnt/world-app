import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo } from 'react'
import { useLocalStorage } from '../hooks/useLocalStorage'

export type FontScaleKey = 'xs' | 'sm' | 'md' | 'xl' | 'xxl'
export type UIScaleKey = 'xs' | 'sm' | 'md'

export interface PinnedList {
    uri: string
    defaultPostHome: boolean
    defaultPostTimelines: string[]
    defaultProfile?: string
}

export interface Preference {
    themeName: string
    themeVariant: 'classic' | 'world'
    pinnedLists: PinnedList[]
    fontScaleKey: FontScaleKey
    uiScaleKey: UIScaleKey
}

export const defaultPreference: Preference = {
    themeName: 'blue',
    themeVariant: 'classic',
    pinnedLists: [],
    fontScaleKey: 'md',
    uiScaleKey: 'md'
}

interface PreferenceState {
    preference: Preference
    setPreference: (preference: Preference) => void
    reset: () => void
}

const PreferenceContext = createContext<PreferenceState>({
    preference: defaultPreference,
    setPreference: () => {},
    reset: () => {}
})

interface PreferenceProviderProps {
    children: ReactNode
}

export const PreferenceProvider = (props: PreferenceProviderProps): ReactNode => {
    const [pref, setPref] = useLocalStorage<Preference>('preference', defaultPreference)

    useEffect(() => {
        const el = document.documentElement
        let fontKey: FontScaleKey = pref.fontScaleKey ?? 'md'
        const fontMigration: Record<string, FontScaleKey> = { lg: 'xl' }
        if ((fontKey as string) in fontMigration) {
            fontKey = fontMigration[fontKey as string]!
            setPref({ ...pref, fontScaleKey: fontKey })
        }
        el.dataset.font = fontKey
        let uiKey: UIScaleKey = pref.uiScaleKey ?? 'md'
        const uiMigration: Record<string, UIScaleKey> = { lg: 'md', xl: 'md' }
        if ((uiKey as string) in uiMigration) {
            uiKey = uiMigration[uiKey as string]!
            setPref({ ...pref, fontScaleKey: fontKey, uiScaleKey: uiKey })
        }
        el.dataset.ui = uiKey
    }, [pref.fontScaleKey, pref.uiScaleKey])

    const reset = useCallback(() => {
        setPref({ ...defaultPreference })
    }, [setPref])

    const value = useMemo(() => {
        return {
            preference: pref,
            setPreference: setPref,
            reset
        }
    }, [pref, setPref, reset])

    return <PreferenceContext.Provider value={value}>{props.children}</PreferenceContext.Provider>
}

export function usePreference<K extends keyof Preference>(
    key: K,
    silent: boolean = false
): [value: Preference[K], set: (value: Preference[K] | ((old: Preference[K]) => Preference[K])) => void] {
    const { preference, setPreference } = useContext(PreferenceContext)

    const set = useCallback(
        (value: Preference[K] | ((old: Preference[K]) => Preference[K])) => {
            if (typeof value === 'function') {
                // eslint-disable-next-line react-hooks/immutability
                preference[key] = (value as (old: Preference[K]) => Preference[K])(preference[key])
            } else {
                preference[key] = value
            }

            if (silent) {
                setPreference(preference)
            } else {
                setPreference({ ...preference })
            }
        },
        [preference, setPreference, key, silent]
    )

    const value = preference[key] ?? defaultPreference[key]

    return [value, set]
}

export const useResetPreference = () => {
    const { reset } = useContext(PreferenceContext)
    return reset
}
