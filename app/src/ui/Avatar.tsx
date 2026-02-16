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
                        width: 'var(--control-header)',
                        height: 'var(--control-header)',
                        borderRadius: 'var(--radius-sm)',
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
                    width: 'var(--control-header)',
                    height: 'var(--control-header)',
                    borderRadius: 'var(--radius-sm)',
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
                    width: 'var(--control-header)',
                    height: 'var(--control-header)',
                    borderRadius: 'var(--radius-sm)',
                    ...props.style
                }}
                name={props.ccid}
            />
        )
    }
}
