import BoringAvatar from 'boring-avatars'
import { Suspense, use, useDeferredValue } from 'react'
import { useTheme } from '../contexts/Theme'

interface Props {
    ccid: string
    src?: string | Promise<string | undefined>
    style?: React.CSSProperties
}

export const Avatar = (props: Props) => {
    const theme = useTheme()

    return (
        <Suspense
            fallback={
                <div
                    style={{
                        width: 'var(--control-header)',
                        height: 'var(--control-header)',
                        borderRadius: 'var(--radius-sm)',
                        backgroundColor: theme.divider /* TODO: theme.skeleton に昇格 */,
                        ...props.style
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
                    overflow: 'hidden',
                    objectFit: 'cover',
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
                    overflow: 'hidden',
                    ...props.style
                }}
                name={props.ccid}
            />
        )
    }
}
