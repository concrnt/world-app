import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useRef } from 'react'

declare global {
    interface Window {
        __concrntHandleBack?: () => boolean
    }
}

// trueを返すとバックイベントを消費する
export type BackHandler = () => boolean

interface BackHandlerState {
    register: (handler: BackHandler) => () => void
}

const BackHandlerContext = createContext<BackHandlerState>({
    register: () => () => {}
})

interface Props {
    children: ReactNode
}

export const BackHandlerProvider = (props: Props) => {
    const handlersRef = useRef<BackHandler[]>([])

    const register = useCallback((handler: BackHandler): (() => void) => {
        handlersRef.current.push(handler)
        return () => {
            handlersRef.current = handlersRef.current.filter((h) => h !== handler)
        }
    }, [])

    useEffect(() => {
        // ネイティブ側(MainActivity.kt)がバック押下時にこれを呼ぶ。falseを返すとfinish()される
        window.__concrntHandleBack = (): boolean => {
            const handlers = handlersRef.current
            for (let i = handlers.length - 1; i >= 0; i--) {
                if (handlers[i]()) return true
            }
            return false
        }
        return () => {
            delete window.__concrntHandleBack
        }
    }, [])

    const value = useMemo(() => ({ register }), [register])

    return <BackHandlerContext.Provider value={value}>{props.children}</BackHandlerContext.Provider>
}

// handlerはrefに保持されるため再レンダーで再登録されず、スタック上の位置はenabledの変化時にのみ動く。
// enabled=falseの間は未登録(=surfaceが開いた時に登録することで、LIFO順=表示順になる)
export const useBackHandler = (handler: BackHandler, enabled: boolean = true): void => {
    const { register } = useContext(BackHandlerContext)
    const handlerRef = useRef(handler)
    handlerRef.current = handler

    useEffect(() => {
        if (!enabled) return
        return register(() => handlerRef.current())
    }, [enabled, register])
}
