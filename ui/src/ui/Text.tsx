import { CSSProperties, ReactNode, Suspense, use, useDeferredValue } from 'react'

interface Props {
    children: ReactNode | Promise<ReactNode>
    style?: CSSProperties
    variant?: 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6' | 'body' | 'caption'
}

const baseStyles: Record<NonNullable<Props['variant']>, CSSProperties> = {
    h1: {
        fontSize: '1.8em',
        fontWeight: 700,
        lineHeight: 1.5
    },
    h2: {
        fontSize: '1.6em',
        fontWeight: 700,
        lineHeight: 1.5
    },
    h3: {
        fontSize: '1.4em',
        fontWeight: 700,
        lineHeight: 1.5
    },
    h4: {
        fontSize: '1.2em',
        fontWeight: 700
    },
    h5: {
        fontSize: '1em',
        fontWeight: 700
    },
    h6: {
        fontSize: '0.9em',
        fontWeight: 700
    },
    body: {
        fontSize: '1em'
    },
    caption: {
        fontSize: '0.875em',
        opacity: 0.7
    }
}

export const Text = (props: Props) => {
    return (
        <Suspense
            fallback={
                <span
                    style={{
                        backgroundColor: '#e0e0e0',
                        color: 'transparent',
                        display: 'inline-block',
                        width: '100%',
                        ...baseStyles[props.variant || 'body'],
                        ...props.style
                    }}
                >
                    {'loading...'}
                </span>
            }
        >
            {useDeferredValue(<Inner {...props} />)}
        </Suspense>
    )
}

const Inner = (props: Props) => {
    const children = props.children instanceof Promise ? use(props.children) : props.children

    return (
        <p
            style={{
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                ...baseStyles[props.variant || 'body'],
                ...props.style
            }}
        >
            {children}
        </p>
    )
}
