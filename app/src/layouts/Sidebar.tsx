import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useRef } from 'react'
import { motion, useMotionValue, animate, useTransform } from 'motion/react'

import { MdMenu } from 'react-icons/md'
import { NavigationProvider } from '../contexts/Navigation'
import { CssVar } from '../types/Theme'

const SIDEBAR_W = 220

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

    // directionLockでyにロックされた縦スクロールでもonDragEndは発火し、infoには
    // 生のジェスチャのoffset/velocityが入るため、xロック時以外は開閉判定しない
    const lockedDirection = useRef<'x' | 'y' | null>(null)

    useEffect(() => {
        const target = props.opened ? width : 0
        const controls = animate(x, target, { duration: 0.12 })
        return () => controls.stop()
    }, [props.opened, width, x])

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
                    x
                }}
                drag="x"
                dragDirectionLock
                dragElastic={0}
                dragMomentum={false}
                dragConstraints={{ left: 0, right: width }}
                onPointerDownCapture={() => {
                    // ジェスチャごとにロック方向をリセットする。onDragStartはframe経由の遅延実行で
                    // 同期発火のonDirectionLockより後に走ることがあるため、ここで行う
                    lockedDirection.current = null
                }}
                onDirectionLock={(axis) => {
                    lockedDirection.current = axis
                }}
                onDragEnd={(_, info) => {
                    const current = x.get()

                    const vx = info.velocity.x
                    const dx = info.offset.x

                    const fast = Math.abs(vx) > popVelocity
                    const far = Math.abs(dx) > popDistance

                    let shouldOpen: boolean

                    if (lockedDirection.current !== 'x') {
                        // yロック中はビューが動いていないので、現在位置=元の開閉状態を維持する
                        shouldOpen = current > width / 2
                    } else if (fast) {
                        shouldOpen = vx > 0
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
