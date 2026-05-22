import { useEffect, useRef, useState } from 'react'
import { decode } from 'blurhash'

interface BlurhashImageProps {
    src: string
    blurhash?: string
    alt?: string
    style?: React.CSSProperties
}

const BLURHASH_WIDTH = 32
const BLURHASH_HEIGHT = 32

/**
 * blurhashプレースホルダー付き画像コンポーネント。
 * blurhashが指定されていればロード中にぼかし画像を表示し、
 * 画像ロード完了後にフェードインする。
 */
export const BlurhashImage = (props: BlurhashImageProps) => {
    const [loaded, setLoaded] = useState(false)
    const canvasRef = useRef<HTMLCanvasElement>(null)

    useEffect(() => {
        if (!props.blurhash || !canvasRef.current) return
        try {
            const pixels = decode(props.blurhash, BLURHASH_WIDTH, BLURHASH_HEIGHT)
            const ctx = canvasRef.current.getContext('2d')
            if (!ctx) return
            const imageData = ctx.createImageData(BLURHASH_WIDTH, BLURHASH_HEIGHT)
            imageData.data.set(pixels)
            ctx.putImageData(imageData, 0, 0)
        } catch (e) {
            console.warn('Failed to decode blurhash:', e)
        }
    }, [props.blurhash])

    // blurhashがない場合は通常のimgを返す
    if (!props.blurhash) {
        return <img src={props.src} alt={props.alt ?? ''} style={props.style} />
    }

    return (
        <div style={{ position: 'relative', overflow: 'hidden', lineHeight: 0, width: '100%', height: '100%' }}>
            <canvas
                ref={canvasRef}
                width={BLURHASH_WIDTH}
                height={BLURHASH_HEIGHT}
                style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                    opacity: loaded ? 0 : 1,
                    transition: 'opacity 0.3s ease'
                }}
            />
            <img
                src={props.src}
                alt={props.alt ?? ''}
                onLoad={() => setLoaded(true)}
                style={{
                    ...props.style,
                    opacity: loaded ? 1 : 0,
                    transition: 'opacity 0.3s ease'
                }}
            />
        </div>
    )
}
