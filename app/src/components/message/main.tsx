import { memo, ReactNode, useEffect, useState } from "react"
import { useClient } from "../../contexts/Client"
import { Message } from "@concrnt/worldlib"

interface Props {
    uri: string
    resolveHint?: string
    lastUpdated?: number
}

export const MessageContainer = memo<Props>((props: Props): ReactNode | null => {

    const { client } = useClient()
    const [message, setMessage] = useState<Message<any> | null>()

    useEffect(() => {
        if (!client) return
        client.getMessage<any>(props.uri, props.resolveHint).then((msg) => {
            setMessage(msg)
        })

    }, [client, props.uri, props.lastUpdated])

    if (!message) return null

    return <div>
        {message.value.body}
    </div>

})

