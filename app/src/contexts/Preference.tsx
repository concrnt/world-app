import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { useLocalStorage } from '../hooks/useLocalStorage'
import { useClient } from './Client'
import { semantics } from '@concrnt/worldlib'
import type { Theme } from '../types/Theme'

export interface Preference {
    themeName: string
    themeVariant: 'classic' | 'world'
    customThemes: Record<string, Theme>
    // プロフィール名 -> リストURIの並び順
    listOrder?: Record<string, string[]>
}

export const defaultPreference: Preference = {
    themeName: 'blue',
    themeVariant: 'classic',
    customThemes: {},
    listOrder: {}
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
    const { client } = useClient()
    const [pref, setPref] = useLocalStorage<Preference>(`preference`, defaultPreference)
    const [initialized, setInitialized] = useState<boolean>(false)

    useEffect(() => {
        if (!client || !client.api) return
        if (initialized) return
        const isNoloadSettings = localStorage.getItem('noloadsettings')
        if (isNoloadSettings) {
            localStorage.removeItem('noloadsettings')
            return
        }

        client.api
            .getDocument<Preference>(semantics.settings(client.ccid))
            .then((doc) => {
                setInitialized(true)
                if (!doc) return
                const data = doc.value
                if (!data) return
                setPref({
                    ...pref,
                    ...data
                })
            })
            .catch((e: any) => {
                console.error('Failed to load settings from cckv', e)
                setInitialized(true)
            })
    }, [client, initialized, pref, setPref])

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
    const { client } = useClient()
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

            const document = {
                key: semantics.settings(client.ccid),
                author: client.ccid,
                schema: 'https://schemas.concrnt.net/utils/settings',
                value: preference,
                createdAt: new Date(),
                policy: {
                    entries: [
                        {
                            url: 'https://policy.concrnt.world/private.json'
                        }
                    ]
                }
            }

            client.api.commit(document).catch((e) => {
                console.error('Failed to save settings to cckv', e)
            })
        },
        [client.api, client.ccid, preference, setPreference, key, silent]
    )

    const value = preference[key] ?? defaultPreference[key]

    return [value, set]
}

export const useResetPreference = () => {
    const { reset } = useContext(PreferenceContext)
    return reset
}
