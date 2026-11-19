import { getCurrent } from '@tauri-apps/plugin-deep-link'
import { listen, type UnlistenFn } from '@tauri-apps/api/event'
import { AUTH_URI_SCHEME } from './externalAuth'

// cckv:// (照会) and concrnt-auth:// (CIP-17 sign-in to an external service) are
// the app's registered URL schemes (tauri.conf.json plugins.deep-link);
// anything else that reaches us is ignored.
const isDeepLinkUrl = (url: string): boolean => url.startsWith('cckv://') || url.startsWith(AUTH_URI_SCHEME)

// The plugin keeps the last opened URL in `current` for the whole process
// lifetime (iOS: filled from RunEvent::Opened, Android: the Kotlin plugin's
// `currentUrl`; neither is ever cleared), and overwrites it on every open,
// warm or cold. So `getCurrent()` hands the same URL out again after
// anything that re-runs the launch path: a MainView remount (account/profile
// switch), `window.location.reload()` (account switch, logout, subkey
// recovery…), or WebKit's automatic page reload after iOS killed the
// WebContent process in the background.
//
// Remember the last URL that was already delivered (by either path) so each
// open is handed out exactly once. sessionStorage lives as long as the
// WebView instance — it survives all of the above but dies with the process,
// together with the plugin's `current` — so it is exactly the right lifetime.
const LAST_DELIVERED_KEY = 'deeplink:lastDelivered'
let lastDeliveredFallback: string | null = null

const getLastDelivered = (): string | null => {
    try {
        return sessionStorage.getItem(LAST_DELIVERED_KEY) ?? lastDeliveredFallback
    } catch {
        return lastDeliveredFallback
    }
}

const setLastDelivered = (url: string): void => {
    lastDeliveredFallback = url
    try {
        sessionStorage.setItem(LAST_DELIVERED_KEY, url)
    } catch {
        // sessionStorage unavailable; the in-memory fallback still covers remounts
    }
}

/**
 * Returns the deep link URL the app was launched with (cold start), once.
 * Resolves null when there is none or it was already delivered.
 */
export const getLaunchDeepLink = async (): Promise<string | null> => {
    const urls = await getCurrent()
    const url = urls?.find(isDeepLinkUrl)
    if (!url || url === getLastDelivered()) return null
    setLastDelivered(url)
    return url
}

/** Fires for deep link URLs opened while the app is already running (warm start). */
export const onDeepLink = (cb: (url: string) => void): Promise<UnlistenFn> =>
    listen<string[]>('deep-link://new-url', (event) => {
        const url = event.payload.find(isDeepLinkUrl)
        if (!url) return
        // The plugin also stored this URL in `current`; mark it delivered so a
        // later getLaunchDeepLink() (remount/reload) does not replay it.
        setLastDelivered(url)
        cb(url)
    })
