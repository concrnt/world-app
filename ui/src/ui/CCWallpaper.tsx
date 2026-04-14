import { Suspense, use, useDeferredValue } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import Wallpaper from '../assets/cc-wallpaper-base.png'
import { CssVar } from '../types/Theme'

interface Props {
    src?: string | Promise<string | undefined>
    children?: ReactNode
    style?: CSSProperties
    onClick?: () => void
}

export const CCWallpaper = (props: Props) => {
    return (
        <Suspense fallback={<WallpaperInner {...props} resolvedSrc={undefined} />}>
            {useDeferredValue(<WallpaperResolver {...props} />)}
        </Suspense>
    )
}

const WallpaperResolver = (props: Props) => {
    const resolvedSrc = props.src instanceof Promise ? use(props.src) : props.src
    return <WallpaperInner {...props} resolvedSrc={resolvedSrc} />
}

interface InnerProps extends Omit<Props, 'src'> {
    resolvedSrc: string | undefined
}

const WallpaperInner = (props: InnerProps) => {
    const src = props.resolvedSrc

    return (
        <div
            style={{
                backgroundColor: CssVar.uiBackground,
                position: 'relative',
                ...props.style
            }}
            onClick={props.onClick}
        >
            <div
                style={{
                    position: 'absolute',
                    backgroundImage: `url(${src || Wallpaper})`,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                    mixBlendMode: src ? 'normal' : 'hard-light',
                    width: '100%',
                    height: '100%',
                    top: 0,
                    left: 0
                }}
            />
            <div
                style={{
                    position: 'relative',
                    width: '100%',
                    height: '100%'
                }}
            >
                {props.children}
            </div>
        </div>
    )
}
