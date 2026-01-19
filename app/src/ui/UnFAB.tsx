import { useOverlay } from '../contexts/Overlay'
import { createPortal } from 'react-dom'

export const UnFab = () => {
    const overlay = useOverlay()

    if (!overlay.slot) return null

    return createPortal(<div />, overlay.slot)
}
