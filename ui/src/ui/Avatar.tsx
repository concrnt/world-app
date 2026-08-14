import BoringAvatar from 'boring-avatars'
import { Suspense, use, useDeferredValue } from 'react'
import { CCImage } from '../contexts/CCImage'

interface Props {
    ccid: string
    src?: string | Promise<string | undefined>
    style?: React.CSSProperties
    onClick?: () => void
    badge?: React.ReactNode
    badgeColor?: string
    badgeSize?: number
}

export const Avatar = (props: Props) => {
    const body = (
        <Suspense
            fallback={
                <div
                    style={{
                        display: 'block',
                        width: '40px',
                        height: '40px',
                        borderRadius: '4px',
                        backgroundColor: '#e0e0e0',
                        ...props.style
                    }}
                />
            }
        >
            {useDeferredValue(<Inner {...props} />)}
        </Suspense>
    )

    if (!props.badge) return body

    const badgeSize = props.badgeSize ?? 16
    return (
        <div style={{ position: 'relative', width: 'fit-content' }}>
            {body}
            <div
                style={{
                    position: 'absolute',
                    bottom: '-3px',
                    right: '-3px',
                    width: `${badgeSize}px`,
                    height: `${badgeSize}px`,
                    borderRadius: '4px',
                    backgroundColor: props.badgeColor,
                    color: '#ffffff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    pointerEvents: 'none'
                }}
            >
                {props.badge}
            </div>
        </div>
    )
}

const Inner = (props: Props) => {
    const src = props.src instanceof Promise ? use(props.src) : props.src

    if (src) {
        return (
            <CCImage
                src={src}
                maxWidth={256}
                alt="avatar"
                style={{
                    display: 'block',
                    width: '40px',
                    height: '40px',
                    borderRadius: '4px',
                    objectFit: 'cover',
                    ...props.style
                }}
                onClick={props.onClick}
            />
        )
    } else {
        return (
            <BoringAvatar
                square
                size={40}
                variant="beam"
                preserveAspectRatio="xMidYMid slice"
                style={{
                    display: 'block',
                    borderRadius: '4px',
                    ...props.style
                }}
                name={props.ccid}
                onClick={props.onClick}
            />
        )
    }
}
