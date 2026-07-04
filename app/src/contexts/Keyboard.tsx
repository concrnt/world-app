import { createContext, ReactNode, useContext, useEffect, useState } from 'react'
import { addPluginListener, PluginListener } from '@tauri-apps/api/core'

export interface KeyboardState {
    visible: boolean
    height: number // キーボードとwebview下端の重なり(CSS px, 非表示時0)
    duration: number // OSのキーボードアニメーション時間(秒, 不明時0)
}

const initialState: KeyboardState = { visible: false, height: 0, duration: 0 }

const KeyboardContext = createContext<KeyboardState>(initialState)

interface Props {
    children: ReactNode
}

export const KeyboardProvider = (props: Props) => {
    const [state, setState] = useState<KeyboardState>(initialState)

    useEffect(() => {
        let listener: PluginListener | null = null
        let fallbackCleanup: (() => void) | null = null
        let unmounted = false

        // ネイティブ側(iOS: keyboardWillChangeFrame / Android: IMEインセット)から
        // キーボードのアニメーション開始前にイベントが届く
        addPluginListener<KeyboardState>('keyboard', 'keyboardChange', (payload) => {
            setState({
                visible: payload.visible,
                height: Math.max(0, payload.height),
                duration: payload.duration
            })
        })
            .then((l) => {
                if (unmounted) {
                    l.unregister()
                    return
                }
                listener = l
            })
            .catch(() => {
                // プラグインがない環境(ブラウザdev等)はvisualViewportで代用
                // (キーボードが完全に出た後に発火するため追従は遅れる)
                const viewport = window.visualViewport
                if (!viewport) return
                const handleResize = (): void => {
                    const height = Math.max(0, document.documentElement.clientHeight - viewport.height)
                    setState({ visible: height > 0, height, duration: 0 })
                }
                viewport.addEventListener('resize', handleResize)
                fallbackCleanup = () => viewport.removeEventListener('resize', handleResize)
            })

        return () => {
            unmounted = true
            listener?.unregister()
            fallbackCleanup?.()
        }
    }, [])

    return <KeyboardContext.Provider value={state}>{props.children}</KeyboardContext.Provider>
}

export const useKeyboard = (): KeyboardState => {
    return useContext(KeyboardContext)
}
