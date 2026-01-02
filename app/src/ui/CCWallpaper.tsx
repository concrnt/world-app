import { CSSProperties, ReactNode } from 'react'
import Wallpaper from '../assets/cc-wallpaper-base.png'
import { useTheme } from '../contexts/Theme'

interface Props {
    src?: string
    children?: ReactNode
    style?: CSSProperties
}

export const CCWallpaper = (props: Props) => {
    const theme = useTheme()

    return (
        <div
            style={{
                backgroundColor: theme.ui.background,
                position: 'relative',
                ...props.style
            }}
        >
            <div
                style={{
                    position: 'absolute',
                    backgroundImage: `url(${props.src || Wallpaper})`,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                    mixBlendMode: props.src ? 'normal' : 'hard-light',
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
