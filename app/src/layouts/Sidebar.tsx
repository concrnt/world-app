import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo } from 'react'
import { motion, useMotionValue, useTransform, animate } from 'motion/react'

const SIDEBAR_W = 320
const EDGE_W = 16

interface Props {
    opened: boolean
    setOpen: (open: boolean) => void
    children: ReactNode
    content: ReactNode
}

interface SidebarLayoutState {
    open: () => void
}

const SidebarLayoutContext = createContext<SidebarLayoutState>({
    open: () => {}
})

export const SidebarLayout = (props: Props) => {
    const x = useMotionValue(-SIDEBAR_W)
    const edgeX = useMotionValue(0)

    const overlayOpacity = useTransform(x, [-SIDEBAR_W, 0], [0, 0.5])
    const sidebarShadow = useTransform(x, [-SIDEBAR_W, 0], ['0 10px 30px rgba(0,0,0,0)', '0 10px 30px rgba(0,0,0,0.2)'])

    const snapTo = useCallback(
        (toOpen: boolean) => {
            props.setOpen(toOpen)
            animate(x, toOpen ? 0 : -SIDEBAR_W, {
                type: 'spring',
                stiffness: 450,
                damping: 40
            })
        },
        [x, props]
    )

    useEffect(() => {
        animate(x, props.opened ? 0 : -SIDEBAR_W, {
            type: 'spring',
            stiffness: 450,
            damping: 40
        })
    }, [props.opened, x])

    const decideOpen = useCallback(
        (info: { offset: { x: number }; velocity: { x: number } }) => {
            const shouldOpen = info.offset.x > SIDEBAR_W * 0.35 || info.velocity.x > 600
            snapTo(shouldOpen)
        },
        [snapTo]
    )

    const open = useCallback(() => {
        props.setOpen(true)
    }, [props])

    const value = useMemo(
        () => ({
            open
        }),
        [open]
    )

    return (
        <>
            {/* backdrop */}
            <motion.div
                style={{
                    position: 'fixed',
                    inset: 0,
                    background: 'black',
                    opacity: overlayOpacity,
                    pointerEvents: props.opened ? 'auto' : 'none',
                    zIndex: 40
                }}
                onClick={() => snapTo(false)}
            />

            {/* 左端ヒットエリア */}
            <motion.div
                style={{
                    position: 'fixed',
                    left: 0,
                    top: 0,
                    width: EDGE_W,
                    height: '100vh',
                    zIndex: 50,
                    touchAction: 'pan-y',
                    x: edgeX
                }}
                drag="x"
                dragDirectionLock
                dragConstraints={{ left: 0, right: SIDEBAR_W }}
                dragElastic={0}
                dragMomentum={false}
                onDrag={(_, info) => {
                    const next = Math.min(0, -SIDEBAR_W + info.offset.x)
                    x.set(next)
                }}
                onDragEnd={(_, info) => {
                    decideOpen(info)
                    animate(edgeX, 0, { type: 'spring', stiffness: 700, damping: 45 })
                }}
            />

            {/* sidebar */}
            <motion.aside
                style={{
                    position: 'fixed',
                    left: 0,
                    top: 0,
                    height: '100vh',
                    width: SIDEBAR_W,
                    x,
                    zIndex: 60,
                    background: 'white',
                    touchAction: 'none',
                    boxShadow: sidebarShadow
                }}
                drag="x"
                dragDirectionLock
                dragConstraints={{ left: -SIDEBAR_W, right: 0 }}
                dragElastic={0}
                dragMomentum={false}
                onDragEnd={(_, info) => decideOpen(info)}
            >
                {props.content}
            </motion.aside>

            <SidebarLayoutContext.Provider value={value}>
                <div style={{ width: '100%', height: '100%' }}>{props.children}</div>
            </SidebarLayoutContext.Provider>
        </>
    )
}

export const useSidebar = () => {
    return useContext(SidebarLayoutContext)
}
