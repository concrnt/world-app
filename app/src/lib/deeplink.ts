import { getCurrent } from '@tauri-apps/plugin-deep-link'
import { listen, type UnlistenFn } from '@tauri-apps/api/event'

// Only cckv:// is registered as the app's URL scheme (tauri.conf.json
// plugins.deep-link); anything else that reaches us is ignored.
const isCckvUrl = (url: string): boolean => url.startsWith('cckv://')

// On iOS the plugin keeps the last opened URL in `current` forever (it is
// filled from RunEvent::Opened and never cleared), so a MainView remount
// (account/profile switch) would see the same launch URL again. Remember what
// was already handed out so each launch URL is consumed exactly once.
const consumed = new Set<string>()

/**
 * Returns the cckv:// URL the app was launched with (cold start), once.
 * Resolves null when there is none or it was already consumed.
 */
export const getLaunchDeepLink = async (): Promise<string | null> => {
    const urls = await getCurrent()
    const url = urls?.find(isCckvUrl)
    if (!url || consumed.has(url)) return null
    consumed.add(url)
    return url
}

/** Fires for cckv:// URLs opened while the app is already running (warm start). */
export const onDeepLink = (cb: (url: string) => void): Promise<UnlistenFn> =>
    listen<string[]>('deep-link://new-url', (event) => {
        const url = event.payload.find(isCckvUrl)
        if (url) cb(url)
    })
