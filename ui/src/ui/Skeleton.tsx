import type { CSSProperties } from 'react'

interface Props {
    style?: CSSProperties
}

export const Skeleton = (props: Props) => {
    return (
        <>
            <div
                style={{
                    position: 'relative',
                    width: '100%',
                    height: '100%',
                    overflow: 'hidden',
                    background: '#e5e7eb',
                    ...props.style
                }}
            >
                <div
                    style={{
                        position: 'absolute',
                        inset: 0,
                        transform: 'translateX(-100%)',
                        background:
                            'linear-gradient(90deg, transparent 0%, rgba(209,213,219,0.8) 50%, transparent 100%)',
                        animation: 'shimmer 1.6 linear infinite'
                    }}
                />
            </div>

            <style>{`
                @keyframes shimmer {
                    0% {
                        transform: translateX(-100%);
                    }
                    100% {
                        transform: translateX(100%);
                    }
                }
            `}</style>
        </>
    )
}
