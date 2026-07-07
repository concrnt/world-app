import { use, useEffect, useRef, useSyncExternalStore } from 'react'

// Suspense向けのSWR(stale-while-revalidate)リソースストア。
// promiseをモジュールレベルで保持することで、リマウントや<Activity>のreveal時に
// 再suspendせず、キャッシュを即描画しつつ裏で再検証する。

interface Entry<T> {
    promise: Promise<T>
    updatedAt: number
    inFlight: boolean
    serialized?: string
}

const store = new Map<string, Entry<unknown>>()
const listeners = new Set<() => void>()

// マウント直後の再検証で初回fetchと二重にならないための猶予
const REVALIDATE_COOLDOWN_MS = 2000

const subscribe = (listener: () => void): (() => void) => {
    listeners.add(listener)
    return () => {
        listeners.delete(listener)
    }
}

const emit = (): void => {
    listeners.forEach((listener) => listener())
}

const safeStringify = (data: unknown): string | undefined => {
    try {
        return JSON.stringify(data)
    } catch {
        return undefined
    }
}

// React の use() が同期的に解決済みとして読めるよう status/value を付与する。
// これがないと再検証で差し替えたpromiseで再suspendしfallbackにちらつく。
type TrackedPromise<T> = Promise<T> & { status?: string; value?: T }

const markFulfilled = <T>(promise: Promise<T>, value: T): Promise<T> => {
    const tracked = promise as TrackedPromise<T>
    tracked.status = 'fulfilled'
    tracked.value = value
    return tracked
}

const fulfilledPromise = <T>(value: T): Promise<T> => markFulfilled(Promise.resolve(value), value)

function getOrCreate<T>(key: string, fetcher: () => Promise<T>): Entry<T> {
    const existing = store.get(key)
    if (existing) return existing as Entry<T>

    const entry: Entry<T> = {
        promise: fetcher(),
        updatedAt: Date.now(),
        inFlight: true,
        serialized: undefined
    }
    entry.promise
        .then((data) => {
            markFulfilled(entry.promise, data)
            entry.updatedAt = Date.now()
            entry.serialized = safeStringify(data)
        })
        .catch(() => {
            // rejectしたpromiseをキャッシュに残すとリトライ不能になるため破棄する
            if (store.get(key) === entry) store.delete(key)
        })
        .finally(() => {
            entry.inFlight = false
        })
    store.set(key, entry)
    return entry
}

function revalidate<T>(key: string, fetcher: () => Promise<T>): void {
    const entry = store.get(key)
    if (!entry || entry.inFlight) return
    if (Date.now() - entry.updatedAt < REVALIDATE_COOLDOWN_MS) return

    entry.inFlight = true
    fetcher()
        .then((data) => {
            const serialized = safeStringify(data)
            if (serialized !== undefined && serialized === entry.serialized) {
                // 内容が変わっていなければ再レンダリングしない
                entry.updatedAt = Date.now()
                entry.inFlight = false
                return
            }
            store.set(key, {
                promise: fulfilledPromise(data),
                updatedAt: Date.now(),
                inFlight: false,
                serialized
            })
            emit()
        })
        .catch(() => {
            // 再検証の失敗は無視して表示中のキャッシュを維持する
            entry.updatedAt = Date.now()
            entry.inFlight = false
        })
}

export function useResource<T>(key: string, fetcher: () => Promise<T>): T {
    const fetcherRef = useRef(fetcher)

    const entry = useSyncExternalStore(subscribe, () => getOrCreate(key, fetcher))

    useEffect(() => {
        fetcherRef.current = fetcher
    })

    useEffect(() => {
        revalidate(key, () => fetcherRef.current())
    }, [key])

    return use(entry.promise)
}

export function invalidateResource(keyPrefix: string): void {
    let deleted = false
    for (const key of store.keys()) {
        if (key.startsWith(keyPrefix)) {
            store.delete(key)
            deleted = true
        }
    }
    if (deleted) emit()
}
