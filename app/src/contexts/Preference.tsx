import { createContext, ReactNode, useCallback, useContext } from 'react'
import { useLocalStorage } from '../hooks/useLocalStorage'

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
}

export const defaultPreference: Preference = {
    themeName: 'blue',
    themeVariant: 'classic',
    pinnedLists: []
}

interface PreferenceState {
    preference: Preference
    setPreference: (preference: Preference) => void
}

const PreferenceContext = createContext<PreferenceState>({
    preference: defaultPreference,
    setPreference: () => {}
})

interface PreferenceProviderProps {
    children: ReactNode
}

export const PreferenceProvider = (props: PreferenceProviderProps): ReactNode => {
    const [pref, setPref] = useLocalStorage<Preference>('preference', defaultPreference)

    return (
        <PreferenceContext.Provider
            value={{
                preference: pref,
                setPreference: setPref
            }}
        >
            {props.children}
        </PreferenceContext.Provider>
    )
}

export function usePreference<K extends keyof Preference>(
    key: K,
    silent: boolean = false
): [value: Preference[K], set: (value: Preference[K]) => void] {
    const { preference, setPreference } = useContext(PreferenceContext)

    const set = useCallback(
        (value: Preference[K]) => {
            // eslint-disable-next-line react-hooks/immutability
            preference[key] = value

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
