import { useSyncExternalStore } from 'react'

export const MOBILE_BREAKPOINT = 768

const query = `(max-width: ${MOBILE_BREAKPOINT - 0.02}px)`

const subscribe = (callback: () => void) => {
    const mql = window.matchMedia(query)
    mql.addEventListener('change', callback)
    return () => mql.removeEventListener('change', callback)
}

const getSnapshot = () => window.matchMedia(query).matches

export const useIsMobile = (): boolean => {
    return useSyncExternalStore(subscribe, getSnapshot)
}
