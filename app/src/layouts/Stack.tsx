import { AnimatePresence, motion, useAnimationControls } from 'motion/react'
import {
    Activity,
    createContext,
    ReactNode,
    Suspense,
    useCallback,
    useContext,
    useEffect,
    useImperativeHandle,
    useMemo,
    useState
} from 'react'

interface StackLayoutContextState {
    set: (child: ReactNode) => void
    push: (child: ReactNode) => void
    pop: () => boolean
    clear: () => boolean
}

const StackLayoutContext = createContext<StackLayoutContextState>({
    set: () => {},
    push: () => {},
    pop: () => false,
    clear: () => false
})

export type StackLayoutRef = StackLayoutContextState

interface Props {
    children: ReactNode
    ref?: React.Ref<StackLayoutRef>
}

export const StackLayout = (props: Props) => {
    const [stack, setStack] = useState<ReactNode[]>([])

    const set = useCallback((child: ReactNode) => {
        setStack([child])
    }, [])

    const push = useCallback((child: ReactNode) => {
        setStack((prev) => [...prev, child])
    }, [])

    const pop = useCallback(() => {
        const hasPopped = stack.length > 0
        setStack((prev) => {
            const newStack = [...prev]
            newStack.pop()
            return newStack
        })
        return hasPopped
    }, [stack.length])

    const clear = useCallback(() => {
        const hasCleared = stack.length > 0
        setStack([])
        return hasCleared
    }, [stack.length])

    useImperativeHandle(props.ref, () => ({
        push,
        pop,
        set,
        clear
    }))

    const value = useMemo(
        () => ({
            push,
            pop,
            set,
            clear
        }),
        [push, pop, set, clear]
    )

    return (
        <StackLayoutContext.Provider value={value}>
            <div
                style={{
                    width: '100%',
                    height: '100%',
                    position: 'relative'
                }}
            >
                <div
                    style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        width: '100%',
                        height: '100%'
                    }}
                >
                    {props.children}
                </div>

                <AnimatePresence>
                    {stack.map((child, index) => {
                        const isFrontmost = index === stack.length - 1
                        return (
                            <Activity key={index} mode={isFrontmost ? 'visible' : 'hidden'}>
                                <Suspense fallback={<></>}>
                                    <SwipableView enabled={isFrontmost} onPop={pop}>
                                        {child}
                                    </SwipableView>
                                </Suspense>
                            </Activity>
                        )
                    })}
                </AnimatePresence>
            </div>
        </StackLayoutContext.Provider>
    )
}

const SwipableView = ({ enabled, onPop, children }: { enabled: boolean; onPop: () => void; children: ReactNode }) => {
    const width = window.innerWidth

    const controls = useAnimationControls()

    useEffect(() => {
        controls.start({ x: 0, transition: { duration: 0.12 } })
    }, [controls])

    const popDistance = Math.max(80, width * 0.3) // 画面幅の30% or 80px
    const popVelocity = 800 // px/s 目安

    return (
        <motion.div
            style={{
                position: 'absolute',
                top: 0,
                width: '100%',
                height: '100%',
                touchAction: 'pan-y'
            }}
            initial={{ x: width || '100%' }}
            animate={controls}
            exit={{ x: width || '100%', transition: { duration: 0.12 } }}
            drag={enabled ? 'x' : false}
            dragDirectionLock
            dragElastic={0}
            dragMomentum={false}
            dragConstraints={enabled ? { left: 0, right: width } : undefined}
            onDragEnd={(_, info) => {
                if (!enabled) return

                const shouldPop = info.offset.x > popDistance || info.velocity.x > popVelocity

                if (shouldPop) {
                    onPop()
                } else {
                    controls.start({ x: 0, transition: { duration: 0.12 } })
                }
            }}
        >
            {children}
        </motion.div>
    )
}

export const useStack = () => {
    return useContext(StackLayoutContext)
}
