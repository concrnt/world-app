import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo } from 'react'
import { usePersistent } from '../hooks/usePersistent'
import { useClient } from './Client'
import { semantics } from '@concrnt/worldlib'

export interface Preference {
    themeName: string
    themeVariant: 'classic' | 'world'
    developerMode: boolean
    hapticsEnabled: boolean
    // プロフィール名 -> リストURIの並び順
    listOrder?: Record<string, string[]>
    // プロフィール名 -> サイドバーで展開中のリストURI
    expandedLists?: Record<string, string[]>
}

export const defaultPreference: Preference = {
    themeName: 'blue',
    themeVariant: 'classic',
    developerMode: false,
    hapticsEnabled: true,
    listOrder: {},
    expandedLists: {}
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
    const [pref, setPref] = usePersistent<Preference>(`preference`, defaultPreference)

    // 別端末での設定変更を取り込む同期チャンネル。localStorageが真のソースで即時表示は
    // 既に効いているため、cckvはno-cacheで読み、起動時とアプリ復帰時に取り込む
    useEffect(() => {
        if (!client || !client.api || client.ccid === '') return

        let lastLoaded = 0
        const load = () => {
            if (Date.now() - lastLoaded < 30_000) return
            lastLoaded = Date.now()
            if (localStorage.getItem('noloadsettings')) {
                localStorage.removeItem('noloadsettings')
                return
            }

            client.api
                .getDocument<Preference>(semantics.settings(client.ccid), undefined, { cache: 'no-cache' })
                .then((doc) => {
                    if (!doc) return
                    const data = doc.value
                    if (!data) return
                    const { customThemes: _legacyCustomThemes, ...settings } = data as Preference & {
                        customThemes?: unknown
                    }
                    setPref((old) => ({
                        ...old,
                        ...settings
                    }))
                })
                .catch((e: any) => {
                    console.error('Failed to load settings from cckv', e)
                })
        }
        load()

        const onVisibilityChange = () => {
            if (document.visibilityState === 'visible') load()
        }
        document.addEventListener('visibilitychange', onVisibilityChange)
        return () => {
            document.removeEventListener('visibilitychange', onVisibilityChange)
        }
    }, [client, setPref])

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
                kind: 'record' as const,
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
