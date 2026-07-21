import { invoke } from '@tauri-apps/api/core'

// Per-device flag: once the age gate has been satisfied we don't re-prompt on
// every launch. Only a pass/fail boolean is stored — never the raw age band.
const LS_PASSED_KEY = 'ageverify:passed'

interface AgeRangeResponse {
    // "under13" | "over13" | "unknown"
    ageRange: string
    // false on iOS < 26.2, non-iOS platforms, or on error
    available: boolean
    // the person (or guardian) declined to share their age range
    declined: boolean
}

export const isAgePassed = (): boolean => localStorage.getItem(LS_PASSED_KEY) === 'true'

const markPassed = (): void => localStorage.setItem(LS_PASSED_KEY, 'true')

/**
 * Runs the on-device age check via Apple's Declared Age Range API (iOS 26.2+).
 * Returns `true` if the user may proceed, `false` if they are confirmed to be
 * under 13 and must be blocked.
 *
 * Privacy: the age band is used solely to make this decision. It is never
 * persisted raw nor transmitted anywhere — only a pass/fail boolean is cached.
 *
 * Fail-open policy: anything other than an explicit, available "under13" result
 * (unavailable platform, declined sharing, over-13, or any error) is a pass, so
 * we never lock out legitimate users or non-iOS platforms.
 */
export async function checkAgeGate(): Promise<boolean> {
    if (isAgePassed()) return true

    let res: AgeRangeResponse
    try {
        res = await invoke<AgeRangeResponse>('plugin:ageverify|request_age_range')
    } catch (err) {
        // Plugin absent (Android / web / desktop / older builds) → pass.
        console.warn('[ageverify] gate unavailable, skipping:', err)
        markPassed()
        return true
    }

    if (res.available && res.ageRange === 'under13') {
        // Do not cache a block — re-check on next launch (a guardian may change
        // the setting).
        return false
    }

    markPassed()
    return true
}
