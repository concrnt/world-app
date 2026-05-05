import { Ref } from 'react'

export interface ScrollViewHandle {
    scrollToTop: () => void
}

export type ScrollViewRef = Ref<ScrollViewHandle>

export interface ScrollViewProps {
    ref?: ScrollViewRef
}
