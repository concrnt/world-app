import BoringAvatar from 'boring-avatars'
import { Suspense, use, useDeferredValue } from 'react'

interface Props {
    ccid: string
    src?: string | Promise<string | undefined>
    style?: React.CSSProperties
}

export const Avatar = (props: Props) => {
    return (
        <Suspense
            fallback={
                <div
                    style={{
                        width: '40px',
                        height: '40px',
                        borderRadius: '4px',
                        backgroundColor: '#e0e0e0'
                    }}
                />
            }
        >
            {useDeferredValue(<Inner {...props} />)}
        </Suspense>
    )
}

const Inner = (props: Props) => {
    const src = props.src instanceof Promise ? use(props.src) : props.src

    if (src) {
        return (
            <img
                src={src}
                alt="avatar"
                style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: '4px',
                    ...props.style
                }}
            />
        )
    } else {
        return (
            <BoringAvatar
                square
                size={40}
                variant="beam"
                style={{
                    borderRadius: '4px',
                    ...props.style
                }}
            />
        )
    }
}
