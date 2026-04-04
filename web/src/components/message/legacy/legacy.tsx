import { useMemo } from 'react'

interface Props {
    message: any
}

export const LegacyMessage = (props: Props) => {
    const document = useMemo(() => {
        if (props.message.document) return JSON.parse(props.message.document)
    }, [props.message.document])

    return <pre>{JSON.stringify(document, null, 2)}</pre>
}
