import { Client, Schemas, semantics } from '@concrnt/worldlib'
import i18n from '../i18n'

export const PUSH_VENDOR_ID = 'world.concrnt.web'

const LS_ENABLED_KEY = 'push:enabled'
const LS_SCHEMAS_KEY = 'push:schemas'

// Thrown by registerPush when the browser notification permission is not
// granted. Callers compare against this to distinguish a permission denial
// from other (network/registration) failures.
export const PUSH_PERMISSION_DENIED_MESSAGE = 'notification permission was not granted'

// Per-device push state lives in localStorage, not the Preference context:
// Preference is synced to the account (cckv://.../settings) and a push
// registration is tied to this specific browser, not the account.
export const DEFAULT_PUSH_SCHEMAS = [
    Schemas.replyAssociation,
    Schemas.mentionAssociation,
    Schemas.rerouteAssociation,
    Schemas.likeAssociation,
    Schemas.reactionAssociation,
    Schemas.readAccessRequestAssociation,
    Schemas.followAck
]

export const isPushEnabled = (): boolean => localStorage.getItem(LS_ENABLED_KEY) === 'true'

export const getPushSchemas = (): string[] => {
    try {
        const raw = localStorage.getItem(LS_SCHEMAS_KEY)
        if (!raw) return DEFAULT_PUSH_SCHEMAS
        const parsed = JSON.parse(raw)
        return Array.isArray(parsed) ? parsed : DEFAULT_PUSH_SCHEMAS
    } catch {
        return DEFAULT_PUSH_SCHEMAS
    }
}

interface CheckPermissionResponse {
    status: 'granted' | 'denied' | 'prompt'
}

export const checkPushPermission = async (): Promise<CheckPermissionResponse> => {
    if (!('Notification' in window)) return { status: 'denied' }
    return { status: Notification.permission === 'default' ? 'prompt' : Notification.permission }
}

// applicationServerKey must be a Uint8Array: passing the base64url string
// directly is not supported by all browsers (notably Safari).
const urlBase64ToUint8Array = (base64url: string): Uint8Array => {
    const padding = '='.repeat((4 - (base64url.length % 4)) % 4)
    const base64 = (base64url + padding).replace(/-/g, '+').replace(/_/g, '/')
    const raw = atob(base64)
    return Uint8Array.from(raw, (c) => c.charCodeAt(0))
}

// The service worker can't read localStorage, so the home domain it needs to
// resolve notification content (web/src/sw.ts) is handed over via IndexedDB.
const writeHomeDomain = (homeDomain: string): Promise<void> =>
    new Promise((resolve, reject) => {
        const open = indexedDB.open('concrnt-push', 1)
        open.onupgradeneeded = () => {
            open.result.createObjectStore('config')
        }
        open.onsuccess = () => {
            const db = open.result
            const tx = db.transaction('config', 'readwrite')
            tx.objectStore('config').put(homeDomain, 'homeDomain')
            tx.oncomplete = () => {
                db.close()
                resolve()
            }
            tx.onerror = () => {
                db.close()
                reject(tx.error)
            }
        }
        open.onerror = () => reject(open.error)
    })

const getPushManager = async (): Promise<PushManager> => {
    if (!('serviceWorker' in navigator)) {
        throw new Error(i18n.t('web.push.browserNotSupported'))
    }
    const registration = await navigator.serviceWorker.ready
    // iOS Safari exposes push only when installed to the home screen.
    if (!registration.pushManager) {
        throw new Error(i18n.t('web.push.browserNotSupportedIos'))
    }
    return registration.pushManager
}

/**
 * Requests browser permission, subscribes to the browser's push service with
 * the server's VAPID key, and upserts the subscription with the concrnt
 * server. Safe to call repeatedly (e.g. on every app start) — the server-side
 * subscribe endpoint is an upsert keyed on (owner, vendorID).
 */
export async function registerPush(client: Client, schemas: string[]): Promise<void> {
    const vapidKey = client.server.meta?.vapidKey
    if (typeof vapidKey !== 'string' || vapidKey === '') {
        throw new Error(i18n.t('web.push.serverNotSupported'))
    }

    const pushManager = await getPushManager()

    const permission = await Notification.requestPermission()
    if (permission !== 'granted') {
        throw new Error(PUSH_PERMISSION_DENIED_MESSAGE)
    }

    const applicationServerKey = urlBase64ToUint8Array(vapidKey)

    // A subscription made with an older VAPID key can't be reused: subscribing
    // over it throws InvalidStateError, so drop it first.
    const existing = await pushManager.getSubscription()
    if (existing) {
        const currentKey = existing.options.applicationServerKey
        const matches =
            currentKey !== null &&
            currentKey.byteLength === applicationServerKey.byteLength &&
            new Uint8Array(currentKey).every((b, i) => b === applicationServerKey[i])
        if (!matches) await existing.unsubscribe()
    }

    const subscription = await pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: applicationServerKey.buffer as ArrayBuffer
    })

    await client.api.subscribeNotification(client.ccid, PUSH_VENDOR_ID, {
        schemas,
        prefixes: [semantics.notificationTimeline(client.ccid, client.currentProfile)],
        subscription: JSON.stringify(subscription.toJSON())
    })

    await writeHomeDomain(client.server.domain)

    localStorage.setItem(LS_ENABLED_KEY, 'true')
    localStorage.setItem(LS_SCHEMAS_KEY, JSON.stringify(schemas))
}

/** Deletes the server-side subscription and the browser subscription. Best-effort. */
export async function unregisterPush(client: Client): Promise<void> {
    await client.api.deleteNotificationSubscription(client.ccid, PUSH_VENDOR_ID).catch(() => {})
    try {
        const registration = await navigator.serviceWorker.ready
        await registration.pushManager?.getSubscription().then((s) => s?.unsubscribe())
    } catch {
        // no service worker / push support — nothing to clean up
    }
    localStorage.setItem(LS_ENABLED_KEY, 'false')
}
