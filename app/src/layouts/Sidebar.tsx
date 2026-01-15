import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo } from 'react'
import { motion, useMotionValue, animate, useTransform } from 'motion/react'

const SIDEBAR_W = 320

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

    const popDistance = Math.max(80, width * 0.3) // 画面幅の30% or 80px
    const popVelocity = 50 // px/s 目安

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
                onDragEnd={(_, info) => {
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
                <aside
                    style={{
                        position: 'absolute',
                        left: -width,
                        top: 0,
                        height: '100vh',
                        width,
                        zIndex: 60,
                        background: 'white',
                        touchAction: 'none'
                    }}
                >
                    {props.content}
                </aside>

                <motion.div
                    style={{
                        position: 'absolute',
                        top: 0,
                        width: '100vw',
                        height: '100vh',
                        background: 'black',
                        zIndex: 50,
                        pointerEvents: props.opened ? 'auto' : 'none',
                        opacity: backdropOpacity
                    }}
                    onClick={() => {
                        props.setOpen(false)
                    }}
                />

                <div
                    style={{
                        position: 'absolute',
                        width: '100vw',
                        height: '100vh'
                    }}
                >
                    {props.children}
                </div>
            </motion.div>
        </SidebarLayoutContext.Provider>
    )
}

export const useSidebar = () => {
    return useContext(SidebarLayoutContext)
}
