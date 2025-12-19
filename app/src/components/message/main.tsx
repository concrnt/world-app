import { ReactNode, useEffect, useState } from "react"
import { useClient } from "../../contexts/Client"
import { Message } from "@concrnt/worldlib"

interface Props {
    uri: string
    resolveHint?: string
    lastUpdated?: number
}

export const MessageContainer = (props: Props): ReactNode | null => {

    const { client } = useClient()
    const [message, setMessage] = useState<Message<any> | null>()

    useEffect(() => {
        if (!client) return
        client.getMessage<any>(props.uri, props.resolveHint).then((msg) => {
            setMessage(msg)
        })
    }, [client, props.uri, props.lastUpdated])

    if (!message) return <div>Loading message...</div>

    return <div
        style={{ 
            display: 'flex',
            flexDirection: 'row',
            gap: '8px',
        }}
    >
        <div>
            <img 
                src={message.authorUser?.profile.avatar} 
                alt="avatar" 
                style={{ 
                    width: '40px', 
                    height: '40px', 
                    borderRadius: '4px', 
                }} 
            />
        </div>
        <div
            style={{ 
                display: 'flex',
                flexDirection: 'column',
                gap: '4px',
            }}
        >
            <div
                style={{ 
                    fontWeight: 'bold',
                }}
            >
                {message.authorUser?.profile.username}
            </div>
            <div
                style={{ 
                }}
            >
                {message.value.body}
            </div>
        </div>
    </div>

}

