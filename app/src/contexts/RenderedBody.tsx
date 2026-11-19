import { createContext, ReactNode, RefObject, useCallback, useContext, useMemo, useRef, useState } from 'react'

export interface RenderedBodyState {
    // 描画済み本文の要素。RenderedBody(components/message)が付ける
    ref: RefObject<HTMLDivElement | null>
    // 最後に読んだ innerText(マウント時と update() 時に更新)
    text: string
    // innerText を読み直して配り直し、読んだ値を返す(翻訳はクリック時にこれで最新の本文を得る)。
    // レンダラは <details> の toggle など、描画後に表示文字列が変わったときに呼ぶ
    update: () => string
}

const RenderedBodyContext = createContext<RenderedBodyState | undefined>(undefined)

interface Props {
    children: ReactNode
}

// 投稿1件ぶんの「描画済み本文の innerText」を配る。記法のソースではなく画面に見えている文字列を、
// AutoSummary(URL抽出)と翻訳(翻訳元)が共通に使う。v1 の AutoSummaryProvider と同じ作り
export const RenderedBodyProvider = (props: Props): ReactNode => {
    const ref = useRef<HTMLDivElement>(null)
    const [text, setText] = useState('')

    const update = useCallback((): string => {
        const current = ref.current?.innerText ?? ''
        setText(current)
        return current
    }, [])

    const value = useMemo<RenderedBodyState>(() => ({ ref, text, update }), [text, update])

    return <RenderedBodyContext.Provider value={value}>{props.children}</RenderedBodyContext.Provider>
}

// Provider外(Oneline・Composerプレビュー等)では undefined
export const useRenderedBody = (): RenderedBodyState | undefined => useContext(RenderedBodyContext)
