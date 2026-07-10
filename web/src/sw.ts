/// <reference lib="webworker" />
import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching'
import { registerRoute } from 'workbox-routing'
import { CacheFirst } from 'workbox-strategies'
import { ExpirationPlugin } from 'workbox-expiration'
import { CacheableResponsePlugin } from 'workbox-cacheable-response'

declare let self: ServiceWorkerGlobalScope

self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        cleanupOutdatedCaches()
        self.skipWaiting()
    }
})

precacheAndRoute(self.__WB_MANIFEST)

const sameOriginAsset = (url: URL): boolean =>
    url.origin === self.location.origin &&
    /\.(?:js|css|woff2?|ttf|json|png|jpg|jpeg|gif|webp|svg|ico|mp3|mp4|webm|wasm)$/.test(url.pathname)

registerRoute(
    ({ url }) => sameOriginAsset(url),
    new CacheFirst({
        cacheName: 'app-assets',
        plugins: [
            new CacheableResponsePlugin({ statuses: [0, 200] }),
            new ExpirationPlugin({
                maxEntries: 500,
                purgeOnQuotaError: true
            })
        ]
    })
)

// --- Push notifications ---
// The push carries only the minimal notification struct
// {uri, schema, author, createdAt} (see concrnt's
// NotificationReactor.buildNotificationPayload); display content is resolved
// on demand via GET /api/v2/resolve, mirroring the native implementation in
// plugins/tauri-plugin-push (PushShared/NotificationContent.swift).

const schemaLike = 'https://schema.concrnt.world/a/like.json'
const schemaReaction = 'https://schema.concrnt.world/a/reaction.json'
const schemaReroute = 'https://schema.concrnt.world/a/reroute.json'
const schemaReply = 'https://schema.concrnt.world/a/reply.json'
const schemaMention = 'https://schema.concrnt.world/a/mention.json'
const schemaReadAccessRequest = 'https://schema.concrnt.world/a/readaccessrequest.json'
const schemaFollowAck = 'https://schema.concrnt.world/ack/follow.json'

interface NotificationContent {
    title: string
    body?: string
    targetUri?: string
    view: 'post' | 'notifications'
    imageUrl?: string
}

const fallbackContent: NotificationContent = {
    title: '新しい通知があります',
    view: 'notifications'
}

// The SW can't read localStorage; the page hands over the home domain via
// IndexedDB when the subscription is registered (web/src/lib/push.ts).
const readHomeDomain = (): Promise<string | undefined> =>
    new Promise((resolve) => {
        const open = indexedDB.open('concrnt-push', 1)
        open.onupgradeneeded = () => {
            open.result.createObjectStore('config')
        }
        open.onsuccess = () => {
            const db = open.result
            try {
                const req = db.transaction('config', 'readonly').objectStore('config').get('homeDomain')
                req.onsuccess = () => {
                    resolve(typeof req.result === 'string' && req.result !== '' ? req.result : undefined)
                    db.close()
                }
                req.onerror = () => {
                    resolve(undefined)
                    db.close()
                }
            } catch {
                resolve(undefined)
                db.close()
            }
        }
        open.onerror = () => resolve(undefined)
    })

const nonEmpty = (s: unknown): string | undefined => (typeof s === 'string' && s !== '' ? s : undefined)

// GET /api/v2/resolve?uri=... — returns the raw SignedDocument, then the
// caller double-parses `.document`.
const fetchResolvedDocument = async (domain: string, uri: string): Promise<Record<string, any> | undefined> => {
    try {
        const response = await fetch(`https://${domain}/api/v2/resolve?uri=${encodeURIComponent(uri)}`, {
            headers: { Accept: 'application/json' }
        })
        if (!response.ok) return undefined
        const body = await response.json()
        if (typeof body.document !== 'string') return undefined
        return JSON.parse(body.document)
    } catch {
        return undefined
    }
}

const resolveAuthorDomain = async (homeDomain: string, author: string): Promise<string | undefined> => {
    const entityDoc = await fetchResolvedDocument(homeDomain, `cckv://${author}`)
    return nonEmpty(entityDoc?.value?.domain)
}

const resolveActorProfile = async (
    homeDomain: string,
    author: string,
    profileId: string | undefined
): Promise<{ username?: string; avatar?: string } | undefined> => {
    const authorDomain = await resolveAuthorDomain(homeDomain, author)
    if (!authorDomain) return undefined
    const uri = `cckv://${author}/concrnt.world/profiles/${profileId ?? 'main'}`
    const profileDoc = await fetchResolvedDocument(authorDomain, uri)
    if (!profileDoc) return undefined
    return {
        username: nonEmpty(profileDoc.value?.username),
        avatar: nonEmpty(profileDoc.value?.avatar)
    }
}

const resolveMessageBody = async (homeDomain: string, targetUri: string): Promise<string | undefined> => {
    const doc = await fetchResolvedDocument(homeDomain, targetUri)
    const body = nonEmpty(doc?.value?.body)
    if (!body) return undefined
    return body.length > 140 ? body.slice(0, 140) : body
}

const buildContent = async (payload: Record<string, any>): Promise<NotificationContent | undefined> => {
    const uri = nonEmpty(payload.uri)
    const homeDomain = await readHomeDomain()
    if (!uri || !homeDomain) return undefined

    // Resolve the association document (ccfs://...) the push refers to.
    const doc = await fetchResolvedDocument(homeDomain, uri)
    if (!doc) return undefined

    // schema/author come pre-resolved in the payload; fall back to the
    // resolved document if the server omitted them.
    const schema = nonEmpty(payload.schema) ?? doc.schema ?? ''
    const author = nonEmpty(payload.author) ?? doc.author ?? ''

    const value = doc.value ?? {}
    const profileOverride = value.profileOverride
    const overrideUsername = nonEmpty(profileOverride?.username)
    const overrideAvatar = nonEmpty(profileOverride?.avatar)
    const profileId = nonEmpty(profileOverride?.profileID)

    const actor = author === '' ? undefined : await resolveActorProfile(homeDomain, author, profileId)
    const username = overrideUsername ?? actor?.username ?? '名無し'
    const imageUrl = overrideAvatar ?? actor?.avatar

    const associate = nonEmpty(doc.associate)

    const messageBody = async (target: string | undefined): Promise<string | undefined> => {
        if (!target) return undefined
        return await resolveMessageBody(homeDomain, target)
    }

    switch (schema) {
        case schemaLike:
            return {
                title: `${username}さんがあなたの投稿にいいねしました`,
                body: await messageBody(associate),
                targetUri: associate,
                view: 'post',
                imageUrl
            }
        case schemaReaction: {
            const shortcode = nonEmpty(value.shortcode) ?? ''
            return {
                title: `${username}さんがあなたの投稿にリアクションしました :${shortcode}:`,
                body: await messageBody(associate),
                targetUri: associate,
                view: 'post',
                imageUrl
            }
        }
        case schemaReroute:
            return {
                title: `${username}さんがあなたの投稿をリルートしました`,
                body: await messageBody(associate),
                targetUri: associate,
                view: 'post',
                imageUrl
            }
        case schemaReply: {
            const target = nonEmpty(value.targetURI) ?? associate
            return {
                title: `${username}さんがあなたの投稿にリプライしました`,
                body: await messageBody(target),
                targetUri: target,
                view: 'post',
                imageUrl
            }
        }
        case schemaMention:
            return {
                title: `${username}さんがあなたをメンションしました`,
                body: await messageBody(associate),
                targetUri: associate,
                view: 'post',
                imageUrl
            }
        case schemaReadAccessRequest:
            return {
                title: `${username}さんが閲覧リクエストを送信しています`,
                view: 'notifications',
                imageUrl
            }
        case schemaFollowAck:
            return {
                title: `${username}さんにフォローされました`,
                view: 'notifications',
                imageUrl
            }
        default:
            return { ...fallbackContent, imageUrl }
    }
}

const withTimeout = <T>(ms: number, promise: Promise<T>): Promise<T | undefined> =>
    Promise.race([promise, new Promise<undefined>((resolve) => setTimeout(() => resolve(undefined), ms))])

self.addEventListener('push', (event) => {
    const notify = async (): Promise<void> => {
        // Never skip showing a notification: the subscription is
        // userVisibleOnly, and a silent push risks the browser revoking it.
        let content = fallbackContent
        try {
            const payload = event.data?.json()
            if (payload) {
                const built = await withTimeout(5000, buildContent(payload))
                if (built) content = built
            }
        } catch (error) {
            console.error('[Service Worker] failed to build push notification content', error)
        }

        const url =
            content.view === 'post' && content.targetUri
                ? `/post/${encodeURIComponent(content.targetUri)}`
                : '/notifications'

        await self.registration.showNotification(content.title, {
            body: content.body,
            icon: content.imageUrl ?? '/192.png',
            data: { url }
        })
    }

    event.waitUntil(notify())
})

self.addEventListener('notificationclick', (event) => {
    event.notification.close()

    const url: string = event.notification.data?.url ?? '/notifications'

    const handle = self.clients
        .matchAll({
            type: 'window',
            includeUncontrolled: true
        })
        .then((clientList) => {
            const matchingClient = clientList.find((c) => c.focused) ?? clientList[0]

            if (matchingClient) {
                matchingClient.focus()
                matchingClient.postMessage({
                    type: 'navigate',
                    url
                })
                return
            }
            return self.clients.openWindow(url)
        })

    event.waitUntil(handle)
})
