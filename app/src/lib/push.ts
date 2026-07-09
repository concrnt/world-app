import { invoke, addPluginListener, type PluginListener } from '@tauri-apps/api/core'
import { Client, Schemas, semantics } from '@concrnt/worldlib'

export const PUSH_VENDOR_ID = 'world.concrnt.app'

// Deployed webpush-relay origin (webpush-relay / webpush-relay-workers).
export const PUSH_RELAY = 'https://webpush-relay.concrnt.net'

const LS_ENABLED_KEY = 'push:enabled'
const LS_SCHEMAS_KEY = 'push:schemas'

// Thrown by registerPush when the OS notification permission is not granted.
// Callers compare against this to distinguish a permission denial from other
// (relay/network/registration) failures.
export const PUSH_PERMISSION_DENIED_MESSAGE = 'notification permission was not granted'

// Per-device push state lives in localStorage, not the Preference context:
// Preference is synced to the account (cckv://.../settings) and a push
// registration is tied to this specific device/install, not the account.
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

interface RequestPermissionResponse {
    granted: boolean
}

interface GetTokenResponse {
    platform: 'apns' | 'fcm'
    token: string
    environment: 'production' | 'sandbox'
}

interface GetOrCreateKeysResponse {
    p256dh: string
    auth: string
}

export const checkPushPermission = (): Promise<CheckPermissionResponse> => invoke('plugin:push|check_permission')

export const requestPushPermission = (): Promise<RequestPermissionResponse> => invoke('plugin:push|request_permission')

export interface LaunchNotification {
    uri: string | null
    view: string | null
}

export const getLaunchNotification = (): Promise<LaunchNotification> => invoke('plugin:push|get_launch_notification')

export const onNotificationTapped = (cb: (payload: LaunchNotification) => void): Promise<PluginListener> =>
    addPluginListener('push', 'notificationTapped', cb)

/**
 * Requests OS permission, gets the native push token + on-device WebPush
 * keypair, and upserts the subscription with the concrnt server. Safe to
 * call repeatedly (e.g. on every app start) — the server-side subscribe
 * endpoint is an upsert keyed on (owner, vendorID).
 */
export async function registerPush(client: Client, schemas: string[]): Promise<void> {
    const permission = await requestPushPermission()
    if (!permission.granted) {
        throw new Error(PUSH_PERMISSION_DENIED_MESSAGE)
    }

    await invoke('plugin:push|set_context', {
        payload: { homeDomain: client.server.domain, ccid: client.ccid }
    })

    const token = await invoke<GetTokenResponse>('plugin:push|get_token')
    const keys = await invoke<GetOrCreateKeysResponse>('plugin:push|get_or_create_keys')

    const endpoint =
        token.platform === 'apns'
            ? `${PUSH_RELAY}/apns/${token.environment}/${token.token}`
            : `${PUSH_RELAY}/fcm/${token.token}`

    await client.api.subscribeNotification(client.ccid, PUSH_VENDOR_ID, {
        schemas,
        prefixes: [semantics.notificationTimeline(client.ccid, client.currentProfile)],
        subscription: JSON.stringify({
            endpoint,
            keys: { p256dh: keys.p256dh, auth: keys.auth }
        })
    })

    localStorage.setItem(LS_ENABLED_KEY, 'true')
    localStorage.setItem(LS_SCHEMAS_KEY, JSON.stringify(schemas))
}

/** Deletes the server-side subscription and the on-device keypair. Best-effort. */
export async function unregisterPush(client: Client): Promise<void> {
    await client.api.deleteNotificationSubscription(client.ccid, PUSH_VENDOR_ID).catch(() => {})
    await invoke('plugin:push|reset_keys').catch(() => {})
    localStorage.setItem(LS_ENABLED_KEY, 'false')
}
