import { getCurrent } from '@tauri-apps/plugin-deep-link'
import { listen, type UnlistenFn } from '@tauri-apps/api/event'
import { AUTH_URI_SCHEME } from './externalAuth'

// cckv:// (照会) and concrnt-auth:// (CIP-17 sign-in to an external service) are
// the app's registered URL schemes (tauri.conf.json plugins.deep-link);
// anything else that reaches us is ignored.
const isDeepLinkUrl = (url: string): boolean => url.startsWith('cckv://') || url.startsWith(AUTH_URI_SCHEME)

// On iOS the plugin keeps the last opened URL in `current` forever (it is
// filled from RunEvent::Opened and never cleared), so a MainView remount
// (account/profile switch) would see the same launch URL again. Remember what
// was already handed out so each launch URL is consumed exactly once.
const consumed = new Set<string>()

/**
 * Returns the deep link URL the app was launched with (cold start), once.
 * Resolves null when there is none or it was already consumed.
 */
export const getLaunchDeepLink = async (): Promise<string | null> => {
    const urls = await getCurrent()
    const url = urls?.find(isDeepLinkUrl)
    if (!url || consumed.has(url)) return null
    consumed.add(url)
    return url
}

/** Fires for deep link URLs opened while the app is already running (warm start). */
export const onDeepLink = (cb: (url: string) => void): Promise<UnlistenFn> =>
    listen<string[]>('deep-link://new-url', (event) => {
        const url = event.payload.find(isDeepLinkUrl)
        if (url) cb(url)
    })
