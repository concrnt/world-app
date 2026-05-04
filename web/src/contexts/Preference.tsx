/* eslint-disable react-refresh/only-export-components */
import { createContext, type ReactNode, useCallback, useContext, useMemo, useState } from 'react'

interface Preference {
    themeName: string
}

interface PreferenceContextState {
    preference: Preference
    setPreference: (preference: Preference) => void
    reset: () => void
}

const defaultPreference: Preference = {
    themeName: 'blue'
}

const PreferenceContext = createContext<PreferenceContextState>({
    preference: defaultPreference,
    setPreference: () => {},
    reset: () => {}
})

const loadPreference = (): Preference => {
    const raw = localStorage.getItem('preference')
    if (!raw) return defaultPreference

    try {
        return { ...defaultPreference, ...JSON.parse(raw) }
    } catch {
        return defaultPreference
    }
}

export const PreferenceProvider = (props: { children: ReactNode }) => {
    const [preference, setPreferenceState] = useState<Preference>(loadPreference)

    const setPreference = useCallback((nextPreference: Preference) => {
        setPreferenceState(nextPreference)
        localStorage.setItem('preference', JSON.stringify(nextPreference))
    }, [])

    const reset = useCallback(() => {
        setPreference(defaultPreference)
    }, [setPreference])

    const value = useMemo(
        () => ({
            preference,
            setPreference,
            reset
        }),
        [preference, setPreference, reset]
    )

    return <PreferenceContext.Provider value={value}>{props.children}</PreferenceContext.Provider>
}

export const usePreference = <K extends keyof Preference>(
    key: K
): [Preference[K], (value: Preference[K] | ((old: Preference[K]) => Preference[K])) => void] => {
    const { preference, setPreference } = useContext(PreferenceContext)

    const setValue = useCallback(
        (nextValue: Preference[K] | ((old: Preference[K]) => Preference[K])) => {
            const resolvedValue = typeof nextValue === 'function' ? nextValue(preference[key]) : nextValue
            setPreference({
                ...preference,
                [key]: resolvedValue
            })
        },
        [key, preference, setPreference]
    )

    return [preference[key], setValue]
}

export const useResetPreference = () => {
    const { reset } = useContext(PreferenceContext)
    return reset
}
