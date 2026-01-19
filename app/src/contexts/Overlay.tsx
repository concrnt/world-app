import { createContext, useContext, useLayoutEffect, useMemo, useRef, useState } from 'react'

interface OverlayContextState {
    slot: HTMLDivElement | null
}

interface Props {
    children: React.ReactNode
}

const OverlayContext = createContext<OverlayContextState>({
    slot: null
})

export const OverlayProvider = (props: Props) => {
    const slotRef = useRef<HTMLDivElement>(null)
    const [slotEl, setSlotEl] = useState<HTMLDivElement | null>(null)

    useLayoutEffect(() => {
        setSlotEl(slotRef.current)
    }, [])

    const value = useMemo(
        () => ({
            slot: slotEl
        }),
        [slotEl]
    )

    return (
        <OverlayContext.Provider value={value}>
            {props.children}
            <div
                className="only-last"
                ref={slotRef}
                data-testid="overlay-slot"
                style={{
                    width: '100%',
                    height: '100%'
                }}
            />
        </OverlayContext.Provider>
    )
}

export const useOverlay = () => {
    return useContext(OverlayContext)
}
