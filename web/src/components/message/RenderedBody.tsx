import { ReactNode, useEffect } from 'react'
import { useRenderedBody } from '../../contexts/RenderedBody'

interface Props {
    // 本文の描画(この要素の innerText が RenderedBodyProvider から配られる)
    children: ReactNode
}

// 描画済み本文を包み、マウント後に innerText を読んで RenderedBodyProvider に渡す。
// レンダラは同期パースなのでマウント時点で本文は揃っている。以後の変化(details の開閉など)はレンダラ側が update() を呼ぶ
export const RenderedBody = (props: Props) => {
    const body = useRenderedBody()
    const update = body?.update

    useEffect(() => {
        update?.()
    }, [update])

    if (!body) return <>{props.children}</>

    return <div ref={body.ref}>{props.children}</div>
}
