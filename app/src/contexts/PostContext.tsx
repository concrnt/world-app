import { createContext, ReactNode, useContext, useEffect, useMemo, useRef } from 'react'

// 「現在開いているビューのデフォルト投稿先」。
// リルートやFABなどビュー内のUIはcontextで消費し、
// ツリー外にいるサイドバーの投稿ボタンはcurrentPostContext()で最前面ビューの値を読む。

export interface PostContextValue {
    destinations: string[]
    profile?: string
}

const empty: PostContextValue = { destinations: [] }

const PostContext = createContext<PostContextValue>(empty)

// effect登録のLIFOレジストリ。webはルータでビューが常に1つなのでエントリ≤1。
// appでは<Activity>が非表示タブのeffectを外すため、末尾=可視スタックの最前面ビュー。
const registry: Array<{ current: PostContextValue }> = []

export const currentPostContext = (): PostContextValue => registry[registry.length - 1]?.current ?? empty

export const PostContextProvider = (props: { destinations: string[]; profile?: string; children: ReactNode }) => {
    const value = useMemo(
        () => ({ destinations: props.destinations, profile: props.profile }),
        // 毎レンダー生成される配列でもcontext値のidentityを安定させる
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [props.destinations.join(','), props.profile]
    )
    const ref = useRef(value)
    ref.current = value
    useEffect(() => {
        registry.push(ref)
        return () => {
            registry.splice(registry.indexOf(ref), 1)
        }
    }, [])
    return <PostContext.Provider value={value}>{props.children}</PostContext.Provider>
}

export const usePostContext = () => useContext(PostContext)
