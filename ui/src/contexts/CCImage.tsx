import { type ComponentType, createContext, createElement, type ReactNode, useContext } from 'react'

// maxWidth/maxHeight are resolution hints for an image proxy, not display sizes
// (display size comes via style). The plain-<img> fallback ignores them.
export interface CCImageProps {
    src?: string
    maxWidth?: number
    maxHeight?: number
    alt?: string
    style?: React.CSSProperties
    loading?: 'eager' | 'lazy'
    onClick?: (e: React.MouseEvent<HTMLImageElement>) => void
}

const CCImageComponentContext = createContext<ComponentType<CCImageProps> | undefined>(undefined)

// The app wraps its tree with this to supply the actual image implementation
// (e.g. one that routes src through the server's image proxy).
export const CCImageProvider = (props: { component: ComponentType<CCImageProps>; children: ReactNode }) => {
    return <CCImageComponentContext.Provider value={props.component}>{props.children}</CCImageComponentContext.Provider>
}

// Renders through the app-provided component when set, else a plain <img>.
export const CCImage = (props: CCImageProps): ReactNode => {
    const imageComponent = useContext(CCImageComponentContext)
    if (imageComponent) {
        // context経由の安定した参照であり、renderごとに新しいコンポーネントを
        // 作っているわけではない(JSXタグにするとstatic-componentsが誤検知する)
        return createElement(imageComponent, props)
    }
    const { maxWidth: _maxWidth, maxHeight: _maxHeight, ...imgProps } = props
    return <img {...imgProps} />
}
