import { ReactNode, Suspense, use } from 'react'
import { Text } from '@concrnt/ui'

interface Props {
    children: Promise<ReactNode>
    variant?: 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6' | 'body' | 'caption'
    style?: React.CSSProperties
}

export const TextLoader = (props: Props) => {
    return (
        <Suspense fallback={<div>Loading...</div>}>
            <Inner {...props} />
        </Suspense>
    )
}

const Inner = (props: Props) => {
    const content = use(props.children)

    return (
        <Text variant={props.variant} style={props.style}>
            {content}
        </Text>
    )
}
