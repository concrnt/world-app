import { CSSProperties, useEffect, useState } from 'react'

interface ModelViewerProps {
    src: string
    style?: CSSProperties
}

export const ModelViewer = (props: ModelViewerProps) => {
    const [loaded, setLoaded] = useState(false)

    useEffect(() => {
        import('@google/model-viewer')
            .then(() => setLoaded(true))
            .catch(() => console.warn('model-viewer failed to load'))
    }, [])

    if (!loaded) {
        return (
            <div style={{ ...props.style, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.6)' }}>
                Loading...
            </div>
        )
    }

    return <model-viewer src={props.src} autoplay camera-controls style={props.style} />
}

declare module 'react' {
    // eslint-disable-next-line @typescript-eslint/no-namespace
    namespace JSX {
        interface IntrinsicElements {
            'model-viewer': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & {
                src: string
                alt?: string
                'camera-controls'?: boolean
                'auto-rotate'?: boolean
                ar?: boolean
                autoplay?: boolean
            }
        }
    }
}
