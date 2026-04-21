import { Suspense, use, useMemo } from 'react'
import { Text } from '@concrnt/ui'
import { useClient } from '../contexts/Client'

interface Props {
    uri: string
}

export const ListName = (props: Props) => {
    const { client } = useClient()

    const textPromise = useMemo(
        () => client!.getList(props.uri).then((list) => list?.title ?? 'No Name'),
        [client, props.uri]
    )

    return (
        <Suspense key={props.uri} fallback={<Text>Loading...</Text>}>
            <Inner textPromise={textPromise} />
        </Suspense>
    )
}

const Inner = ({ textPromise }: { textPromise: Promise<string> }) => {
    const text = use(textPromise)

    return <Text>{text}</Text>
}
