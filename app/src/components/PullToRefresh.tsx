import { RefObject, useEffect, useEffectEvent, useRef, useState } from 'react'
import { ReactNode } from 'react'
import { MdArrowDownward, MdSync } from 'react-icons/md'

const PTR_HEIGHT = 60

export interface Props {
    positionRef: RefObject<number>
    isFetching: boolean
    children: ReactNode
    onRefresh: () => Promise<void>
}

export const PullToRefresh = (props: Props): ReactNode => {
    const scrollParentRef = useRef<HTMLDivElement>(null)

    const [touchPosition, setTouchPosition] = useState<number>(0)
    const [loaderSize, setLoaderSize] = useState<number>(0)
    const [loadable, setLoadable] = useState<boolean>(false)
    const [ptrEnabled, setPtrEnabled] = useState<boolean>(false)

    const onTouchStart = useEffectEvent((raw: Event) => {
        const e = raw as TouchEvent
        setTouchPosition(e.touches[0].clientY)
        setLoadable(props.positionRef.current === 0)
    })

    const onTouchMove = useEffectEvent((raw: Event) => {
        if (!loadable) return
        const e = raw as TouchEvent
        if (!scrollParentRef.current) return
        const delta = e.touches[0].clientY - touchPosition
        setLoaderSize(Math.min(Math.max(delta, 0), PTR_HEIGHT))
        if (delta >= PTR_HEIGHT) setPtrEnabled(true)
    })

    const onTouchEnd = useEffectEvent(() => {
        setLoaderSize(0)
        if (ptrEnabled) {
            if (props.isFetching) {
                setPtrEnabled(false)
                return
            }
            props.onRefresh().then(() => {
                setPtrEnabled(false)
            })
        }
    })

    useEffect(() => {
        if (!scrollParentRef.current) return
        const current = scrollParentRef.current
        current.addEventListener('touchstart', onTouchStart)
        current.addEventListener('touchmove', onTouchMove)
        current.addEventListener('touchend', onTouchEnd)
        return () => {
            current.removeEventListener('touchstart', onTouchStart)
            current.removeEventListener('touchmove', onTouchMove)
            current.removeEventListener('touchend', onTouchEnd)
        }
    }, [])

    return (
        <>
            <div
                style={{
                    height: `${ptrEnabled ? PTR_HEIGHT : loaderSize}px`,
                    width: '100%',
                    position: 'relative',
                    color: 'text.secondary',
                    display: 'flex',
                    transition: 'height 0.2s ease-in-out',
                    overflow: 'hidden'
                }}
            >
                <div
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        height: `${PTR_HEIGHT}px`,
                        position: 'absolute',
                        width: '100%',
                        bottom: 0,
                        left: 0
                    }}
                >
                    {props.isFetching ? (
                        <MdSync
                            size={24}
                            style={{
                                animation: 'ptr-spin 1s linear infinite'
                            }}
                        />
                    ) : (
                        <MdArrowDownward
                            style={{
                                transform: `rotate(${ptrEnabled ? 0 : 180}deg)`,
                                transition: 'transform 0.2s ease-in-out'
                            }}
                        />
                    )}
                </div>
            </div>
            <div
                ref={scrollParentRef}
                style={{
                    display: 'flex',
                    flex: 1,
                    overflow: 'hidden',
                    flexDirection: 'column'
                }}
            >
                {props.children}
            </div>
            <style>{`
                @keyframes ptr-spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(-360deg); }
                }
            `}</style>
        </>
    )
}
