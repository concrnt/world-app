import { AnimatePresence } from 'motion/react'
import {
    createContext,
    type ReactNode,
    useCallback,
    useContext,
    useEffect,
    useLayoutEffect,
    useMemo,
    useRef,
    useState
} from 'react'
import { createPortal } from 'react-dom'

interface OverlayRegistration {
    closeOnBack: boolean
    requestClose: () => void
}

interface OverlayStackState {
    closeTop: () => boolean
    handleBackRequest: () => boolean
}

// 操作関数と開閉状態を別contextにする。同居させるとopenのたびに操作側の参照も変わり、
// useOverlayStackを依存配列に持つeffectが再実行されてしまう
const OverlayStackContext = createContext<OverlayStackState>({
    closeTop: () => false,
    handleBackRequest: () => false
})

const OverlayAnyOpenContext = createContext<boolean>(false)

// OverlaySurfaceが使う内部context。rootのマウントで操作contextの参照が変わらないよう分離
const OverlayRegistryContext = createContext<{
    root: HTMLDivElement | null
    register: (r: OverlayRegistration) => () => void
}>({ root: null, register: () => () => {} })

interface Props {
    children: ReactNode
}

export const OverlayStackProvider = (props: Props) => {
    const rootRef = useRef<HTMLDivElement>(null)
    const [root, setRoot] = useState<HTMLDivElement | null>(null)
    useLayoutEffect(() => {
        setRoot(rootRef.current)
    }, [])

    // 開いている順に並ぶ。back/Escのディスパッチにしか使わないので実体はrefに置き、
    // anyOpen(スクロールロック・BackBridge)だけstateで購読させる
    const entriesRef = useRef<OverlayRegistration[]>([])
    const [openCount, setOpenCount] = useState(0)

    const register = useCallback((r: OverlayRegistration) => {
        entriesRef.current.push(r)
        setOpenCount((c) => c + 1)
        return () => {
            entriesRef.current = entriesRef.current.filter((e) => e !== r)
            setOpenCount((c) => c - 1)
        }
    }, [])

    // 宣言的なので「閉じる」は要求のみ。実際のcloseは呼び出し元がopen=falseにすることで起きる
    const closeTop = useCallback((): boolean => {
        const top = entriesRef.current[entriesRef.current.length - 1]
        if (!top) return false
        top.requestClose()
        return true
    }, [])

    const handleBackRequest = useCallback((): boolean => {
        const top = entriesRef.current[entriesRef.current.length - 1]
        if (!top) return false
        if (top.closeOnBack) top.requestClose()
        // オーバーレイ表示中はバックイベントをここで消費し、下のナビゲーションに流さない
        return true
    }, [])

    const anyOpen = openCount > 0

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
            closeTop,
            handleBackRequest
        }),
        [closeTop, handleBackRequest]
    )

    const registry = useMemo(
        () => ({
            root,
            register
        }),
        [root, register]
    )

    return (
        <OverlayStackContext.Provider value={value}>
            <OverlayRegistryContext.Provider value={registry}>
                <OverlayAnyOpenContext.Provider value={anyOpen}>
                    {props.children}
                    {/* zIndexは使わない: childrenの後ろに描画されるので既存UIより前。
                        各OverlaySurfaceのhost divがopen時にここへappendされ、DOM順=open順=重なり順 */}
                    <div ref={rootRef} data-testid="overlay-root" />
                </OverlayAnyOpenContext.Provider>
            </OverlayRegistryContext.Provider>
        </OverlayStackContext.Provider>
    )
}

interface OverlaySurfaceProps {
    open: boolean
    onClose: () => void
    closeOnBack?: boolean
    children: ReactNode
}

// オーバーレイの宣言的primitive。呼び出し元のツリーでレンダリングし続けたまま
// createPortalでDOMだけをoverlay rootへ飛ばすので、contextも再レンダーも普通に繋がる
export const OverlaySurface = (props: OverlaySurfaceProps) => {
    const { root, register } = useContext(OverlayRegistryContext)
    const hostRef = useRef<HTMLDivElement | null>(null)
    // exitアニメーション中もportalを維持するため、openから遅れて落ちる
    const [mounted, setMounted] = useState(false)

    const onCloseRef = useRef(props.onClose)
    onCloseRef.current = props.onClose

    // openになったらhost divをroot末尾へappend。既存hostの再append(=exit中の再open)は
    // appendChildの仕様で末尾への移動になるので、連打してもリークせず順序も最新のopen順になる
    useEffect(() => {
        if (!props.open || !root) return
        let el = hostRef.current
        if (!el) {
            el = document.createElement('div')
            el.style.position = 'fixed'
            el.style.inset = '0'
            el.style.overflow = 'hidden'
            hostRef.current = el
        }
        root.appendChild(el)
        setMounted(true)
    }, [props.open, root])

    // 通常のcloseはonExitCompleteが破棄する。ここは呼び出し元ごとunmountされたときの残骸防止
    useEffect(() => {
        return () => {
            hostRef.current?.remove()
            hostRef.current = null
        }
    }, [])

    // back/Esc対象への登録。onCloseはrefで参照するので再レンダーで再登録されず、
    // スタック上の位置(LIFO順)はopenの変化時にのみ動く
    useEffect(() => {
        if (!props.open) return
        return register({
            closeOnBack: props.closeOnBack ?? true,
            requestClose: () => onCloseRef.current()
        })
    }, [props.open, props.closeOnBack, register])

    if (!mounted || !hostRef.current) return null
    // portalはDOMを飛ばしてもReactツリー上の親へ合成イベントをバブリングさせるため、
    // 呼び出し元(リスト行のonClick等)にオーバーレイ内の操作が漏れないようここで堰き止める
    const stop = (e: { stopPropagation: () => void }) => e.stopPropagation()
    return createPortal(
        <div
            style={{ display: 'contents' }}
            onClick={stop}
            onMouseDown={stop}
            onMouseUp={stop}
            onPointerDown={stop}
            onPointerUp={stop}
            onTouchStart={stop}
            onTouchEnd={stop}
            onKeyDown={stop}
            onKeyUp={stop}
        >
            <AnimatePresence
                onExitComplete={() => {
                    hostRef.current?.remove()
                    hostRef.current = null
                    setMounted(false)
                }}
            >
                {props.open && props.children}
            </AnimatePresence>
        </div>,
        hostRef.current
    )
}

export const useOverlayStack = (): OverlayStackState => {
    return useContext(OverlayStackContext)
}

export const useOverlayAnyOpen = (): boolean => {
    return useContext(OverlayAnyOpenContext)
}
