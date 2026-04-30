import { CachedPromise } from '@concrnt/worldlib'
import { use, useSyncExternalStore } from 'react'

export function useSubscribe<T>(cachedPromise: CachedPromise<T>): [value: T, reload: () => void] {
    const subscribe = (callback: () => void) => {
        cachedPromise.subscribe(callback)

        return () => {
            cachedPromise.unsubscribe(callback)
        }
    }

    const reload = () => {
        cachedPromise.reload()
    }

    const snapshot = useSyncExternalStore(subscribe, () => cachedPromise.value())

    const value = use(snapshot)

    return [value, reload]
}
