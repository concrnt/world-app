import { useEffect, useState } from 'react'
import { Avatar, CfmRenderer, CssVar, Text } from '@concrnt/ui'
import { useNavigate } from 'react-router-dom'
import { type Message, type RerouteMessageSchema } from '@concrnt/worldlib'
import { useClient } from '../../contexts/Client'
import type { MessageProps } from './types'
import { MessageActions } from './MessageActions'
import { MessageDestinations, formatTimestamp } from './common'

export const RerouteMessage = (props: MessageProps<RerouteMessageSchema>) => {
    const { client } = useClient()
    const navigate = useNavigate()
    const message = props.message
    const rerouteId = message.value.rerouteMessageId
    const [rerouteMessage, setRerouteMessage] = useState<Message<unknown> | null>(null)

    useEffect(() => {
        if (!rerouteId || !client) return
        void client.getMessage<unknown>(rerouteId).then((nextMessage) => {
            setRerouteMessage(nextMessage)
        })
    }, [client, rerouteId])

    return (
        <div
            style={{
                display: 'flex',
                flexDirection: 'column',
                gap: CssVar.space(2)
            }}
        >
            <div
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: CssVar.space(2),
                    paddingLeft: `calc(40px + ${CssVar.space(2)})`,
                    opacity: 0.72
                }}
            >
                <Text variant="caption">{message.authorProfile.username} がリルート</Text>
                <Text variant="caption">{formatTimestamp(message.createdAt)}</Text>
            </div>

            {rerouteMessage && (
                <div
                    style={{
                        display: 'flex',
                        flexDirection: 'row',
                        gap: CssVar.space(2)
                    }}
                >
                    <button
                        type="button"
                        onClick={() => navigate(`/profile/${encodeURIComponent(rerouteMessage.author)}`)}
                        style={{ border: 'none', backgroundColor: 'transparent', cursor: 'pointer' }}
                    >
                        <Avatar ccid={rerouteMessage.author} src={rerouteMessage.authorProfile.avatar} />
                    </button>
                    <div
                        style={{
                            display: 'flex',
                            flexDirection: 'column',
                            gap: CssVar.space(2),
                            flex: 1
                        }}
                    >
                        <div
                            style={{
                                display: 'flex',
                                alignItems: 'baseline',
                                gap: CssVar.space(2),
                                flexWrap: 'wrap'
                            }}
                        >
                            <button
                                type="button"
                                onClick={() => navigate(`/profile/${encodeURIComponent(rerouteMessage.author)}`)}
                                style={{
                                    border: 'none',
                                    backgroundColor: 'transparent',
                                    padding: 0,
                                    fontWeight: 700,
                                    cursor: 'pointer',
                                    color: CssVar.contentText
                                }}
                            >
                                {rerouteMessage.authorProfile.username}
                            </button>
                            <button
                                type="button"
                                onClick={() => navigate(`/post/${encodeURIComponent(rerouteId)}`)}
                                style={{
                                    border: 'none',
                                    backgroundColor: 'transparent',
                                    padding: 0,
                                    cursor: 'pointer',
                                    color: CssVar.contentText,
                                    opacity: 0.72
                                }}
                            >
                                <Text variant="caption">{formatTimestamp(rerouteMessage.createdAt)}</Text>
                            </button>
                        </div>
                        {'body' in (rerouteMessage.value as Record<string, unknown>) && (
                            <CfmRenderer
                                messagebody={String((rerouteMessage.value as Record<string, unknown>).body ?? '')}
                                emojiDict={{}}
                            />
                        )}
                        <MessageDestinations message={rerouteMessage} />
                        <MessageActions message={message} />
                    </div>
                </div>
            )}
        </div>
    )
}
