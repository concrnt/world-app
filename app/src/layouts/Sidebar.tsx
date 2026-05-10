import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useRef } from 'react'
import { motion, useMotionValue, animate, useTransform } from 'motion/react'

import { MdMenu } from 'react-icons/md'
import { NavigationProvider } from '../contexts/Navigation'
import { CssVar } from '../types/Theme'

const SIDEBAR_W = 220

// この値(px)以上縦に指が動いたら「縦スクロール」と判定してサイドバーのドラッグを抑制する。
// 小さくするとスクロール判定がシビアになり、大きくすると横スワイプ時の縦ブレを許容する。8〜16あたりがよさげです。
const SCROLL_THRESHOLD = 12

interface Props {
    opened: boolean
    setOpen: (open: boolean) => void
    children: ReactNode
    content: ReactNode
    width?: number
}

interface SidebarLayoutState {
    open: () => void
}

const SidebarLayoutContext = createContext<SidebarLayoutState>({
    open: () => {}
})

export const SidebarLayout = (props: Props) => {
    const width = props.width ?? SIDEBAR_W

    const x = useMotionValue(props.opened ? width : 0)

    useEffect(() => {
        const target = props.opened ? width : 0
        const controls = animate(x, target, { duration: 0.12 })
        return () => controls.stop()
    }, [props.opened, width, x])

    // 縦スクロール検知: タッチの縦移動量が閾値を超えたらスクロールとみなす
    const pointerStartY = useRef<number | null>(null)
    const isScrolling = useRef(false)

    useEffect(() => {
        const handlePointerDown = (e: PointerEvent) => {
            pointerStartY.current = e.clientY
            isScrolling.current = false
        }
        const handlePointerMove = (e: PointerEvent) => {
            if (pointerStartY.current === null) return
            const dy = Math.abs(e.clientY - pointerStartY.current)
            if (dy > SCROLL_THRESHOLD) {
                isScrolling.current = true
            }
        }
        const handlePointerUp = () => {
            pointerStartY.current = null
            requestAnimationFrame(() => {
                isScrolling.current = false
            })
        }

        window.addEventListener('pointerdown', handlePointerDown)
        window.addEventListener('pointermove', handlePointerMove)
        window.addEventListener('pointerup', handlePointerUp)
        window.addEventListener('pointercancel', handlePointerUp)

        return () => {
            window.removeEventListener('pointerdown', handlePointerDown)
            window.removeEventListener('pointermove', handlePointerMove)
            window.removeEventListener('pointerup', handlePointerUp)
            window.removeEventListener('pointercancel', handlePointerUp)
        }
    }, [])

    const popDistance = Math.max(80, width * 0.3) // 画面幅の30% or 80px
    const popVelocity = 100 // px/s 目安

    const backdropOpacity = useTransform(x, [0, width], [0, 0.5])

    const open = useCallback(() => {
        props.setOpen(true)
    }, [props])

    const value = useMemo(() => ({ open }), [open])

    return (
        <SidebarLayoutContext.Provider value={value}>
            <motion.div
                style={{
                    position: 'absolute',
                    top: 0,
                    touchAction: 'pan-y',
                    x
                }}
                drag="x"
                dragDirectionLock
                dragElastic={0}
                dragMomentum={false}
                dragConstraints={{ left: 0, right: width }}
                onDrag={() => {
                    // 縦スクロール中は横ドラッグを無効化（サイドバーを元の位置に固定）
                    // サイドバーが開いている時は閉じる操作を妨げない
                    if (!props.opened && isScrolling.current) {
                        x.set(0)
                    }
                }}
                onDragEnd={(_, info) => {
                    // 縦スクロール中にドラッグが終了した場合は開閉判定をスキップ
                    // サイドバーが開いている時は閉じる操作を妨げない
                    if (!props.opened && isScrolling.current) {
                        animate(x, 0, { duration: 0.12 })
                        return
                    }

                    const current = x.get()

                    const v = info.velocity.x

                    const dx = info.offset.x

                    const fast = Math.abs(v) > popVelocity
                    const far = Math.abs(dx) > popDistance

                    let shouldOpen: boolean

                    if (fast) {
                        shouldOpen = v > 0
                    } else if (far) {
                        shouldOpen = dx > 0
                    } else {
                        shouldOpen = current > width / 2
                    }

                    const target = shouldOpen ? width : 0
                    animate(x, target, { duration: 0.12 })
                    props.setOpen(shouldOpen)
                }}
            >
                <div
                    style={{
                        position: 'absolute',
                        width: '100vw',
                        height: '100vh',
                        overflow: 'hidden'
                    }}
                >
                    <NavigationProvider
                        backNode={
                            <div
                                style={{
                                    width: '100%',
                                    height: '100%',
                                    display: 'flex',
                                    justifyContent: 'center',
                                    alignItems: 'center'
                                }}
                                onClick={() => open()}
                            >
                                <MdMenu size={24} />
                            </div>
                        }
                    >
                        {props.children}
                    </NavigationProvider>
                </div>

                <div
                    style={{
                        position: 'absolute',
                        left: -width,
                        top: 0,
                        height: '100vh',
                        width,
                        pointerEvents: 'none',
                        backgroundColor: CssVar.backdropBackground
                    }}
                />

                <motion.div
                    style={{
                        position: 'absolute',
                        top: 0,
                        left: -width,
                        width: `calc(100vw + ${width}px)`,
                        height: '100vh',
                        background: 'black',
                        pointerEvents: props.opened ? 'auto' : 'none',
                        opacity: backdropOpacity
                    }}
                    onClick={() => {
                        props.setOpen(false)
                    }}
                />

                <aside
                    style={{
                        position: 'absolute',
                        left: -width,
                        top: 0,
                        height: '100vh',
                        width,
                        touchAction: 'none'
                    }}
                >
                    {props.content}
                </aside>
            </motion.div>
        </SidebarLayoutContext.Provider>
    )
}

export const useSidebar = () => {
    return useContext(SidebarLayoutContext)
}
