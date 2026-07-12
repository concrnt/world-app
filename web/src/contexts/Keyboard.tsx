import { createContext, ReactNode, useContext, useEffect, useState } from 'react'

// app/src/contexts/Keyboard.tsx のブラウザ版ミラー。
// appはネイティブプラグインからキーボードイベントを受け取るが、
// webではvisualViewportの縮みからキーボードの重なり高さを擬似的に算出する
// (キーボードが完全に出た後に発火するため追従は遅れる)
export interface KeyboardState {
    visible: boolean
    height: number // キーボードとviewport下端の重なり(CSS px, 非表示時0)
    duration: number // webでは常に0(visualViewportはアニメーション情報を持たない)
}

const initialState: KeyboardState = { visible: false, height: 0, duration: 0 }

const KeyboardContext = createContext<KeyboardState>(initialState)

interface Props {
    children: ReactNode
}

export const KeyboardProvider = (props: Props) => {
    const [state, setState] = useState<KeyboardState>(initialState)

    useEffect(() => {
        const viewport = window.visualViewport
        if (!viewport) return

        const handleResize = (): void => {
            const height = Math.max(0, document.documentElement.clientHeight - viewport.height)
            setState({ visible: height > 0, height, duration: 0 })
        }
        viewport.addEventListener('resize', handleResize)
        return () => viewport.removeEventListener('resize', handleResize)
    }, [])

    return <KeyboardContext.Provider value={state}>{props.children}</KeyboardContext.Provider>
}

export const useKeyboard = (): KeyboardState => {
    return useContext(KeyboardContext)
}
