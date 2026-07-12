import { AnimatePresence } from 'motion/react'
import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'

interface OverlayEntry {
    id: number
    kind: string
    node: ReactNode
    closeOnBack: boolean
}

interface PushOptions {
    kind: string
    render: (close: () => void) => ReactNode
    closeOnBack?: boolean
}

interface OverlayStackState {
    push: (opts: PushOptions) => number
    close: (id: number) => void
    closeKind: (kind: string) => void
    closeTop: () => boolean
    anyOpen: boolean
    handleBackRequest: () => boolean
}

const OverlayStackContext = createContext<OverlayStackState>({
    push: () => 0,
    close: () => {},
    closeKind: () => {},
    closeTop: () => false,
    anyOpen: false,
    handleBackRequest: () => false
})

interface Props {
    children: ReactNode
}

export const OverlayStackProvider = (props: Props) => {
    const [stack, setStack] = useState<OverlayEntry[]>([])
    const stackRef = useRef<OverlayEntry[]>([])
    stackRef.current = stack
    const nextId = useRef(1)

    const close = useCallback((id: number) => {
        setStack((prev) => prev.filter((e) => e.id !== id))
    }, [])

    const push = useCallback(
        (opts: PushOptions): number => {
            const id = nextId.current++
            const entry: OverlayEntry = {
                id,
                kind: opts.kind,
                node: opts.render(() => close(id)),
                closeOnBack: opts.closeOnBack ?? true
            }
            setStack((prev) => [...prev, entry])
            return id
        },
        [close]
    )

    const closeKind = useCallback((kind: string) => {
        setStack((prev) => prev.filter((e) => e.kind !== kind))
    }, [])

    const closeTop = useCallback((): boolean => {
        const top = stackRef.current[stackRef.current.length - 1]
        if (!top) return false
        close(top.id)
        return true
    }, [close])

    const handleBackRequest = useCallback((): boolean => {
        const top = stackRef.current[stackRef.current.length - 1]
        if (!top) return false
        if (top.closeOnBack) close(top.id)
        // オーバーレイ表示中はバックイベントをここで消費し、下のナビゲーションに流さない
        return true
    }, [close])

    const anyOpen = stack.length > 0

    useEffect(() => {
        if (!anyOpen) return

        const prev = document.body.style.overflow
        document.body.style.overflow = 'hidden'
        return () => {
            document.body.style.overflow = prev
        }
    }, [anyOpen])

    const value = useMemo(
        () => ({
            push,
            close,
            closeKind,
            closeTop,
            anyOpen,
            handleBackRequest
        }),
        [push, close, closeKind, closeTop, anyOpen, handleBackRequest]
    )

    return (
        <OverlayStackContext.Provider value={value}>
            {props.children}
            {/* zIndexは使わない: childrenの後ろに描画されるので既存UIより前、配列順=push順=重なり順 */}
            <AnimatePresence>
                {stack.map((entry) => (
                    <div
                        key={entry.id}
                        style={{
                            position: 'fixed',
                            inset: 0,
                            overflow: 'hidden'
                        }}
                    >
                        {entry.node}
                    </div>
                ))}
            </AnimatePresence>
        </OverlayStackContext.Provider>
    )
}

export const useOverlayStack = (): OverlayStackState => {
    return useContext(OverlayStackContext)
}
