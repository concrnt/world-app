import { Ref } from 'react'

export interface ScrollViewHandle {
    scrollToTop: () => void
    /** スクロールコンテナが完全に先頭(scrollTop===0)か */
    isAtTop?: () => boolean
    /** 下部タブの再タップ時の処理(未定義ならscrollToTopにフォールバック) */
    reselect?: () => void
}

export type ScrollViewRef = Ref<ScrollViewHandle>

export interface ScrollViewProps {
    ref?: ScrollViewRef
}
