import { useOverlayAnyOpen, useOverlayStack } from '@concrnt/ui'
import { useBackHandler } from '../contexts/BackHandler'

// OverlayStackProviderの内側に置く。オーバーレイが開いている間だけ登録することで、
// 他のsurface(MediaViewer等)と開いた順=表示順でLIFOディスパッチされる
export const OverlayStackBackBridge = () => {
    const overlayStack = useOverlayStack()
    const anyOpen = useOverlayAnyOpen()
    useBackHandler(() => overlayStack.handleBackRequest(), anyOpen)
    return null
}
