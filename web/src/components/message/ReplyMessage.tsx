import { useEffect, useState } from 'react'
import { Avatar, CfmRenderer, CssVar, Text } from '@concrnt/ui'
import { useNavigate } from 'react-router-dom'
import { type Message, type ReplyMessageSchema } from '@concrnt/worldlib'
import { useClient } from '../../contexts/Client'
import type { MessageProps } from './types'
import { MessageActions } from './MessageActions'
import { MessageDestinations } from './common'
import { formatTimestamp } from './utils'

export const ReplyMessage = (props: MessageProps<ReplyMessageSchema>) => {
    const { client } = useClient()
    const navigate = useNavigate()
    const message = props.message
    const replyToId = message.value.replyToMessageId
    const [replyToMessage, setReplyToMessage] = useState<Message<unknown> | null>(null)

    useEffect(() => {
        if (!replyToId || !client) return
        void client.getMessage<unknown>(replyToId).then((nextMessage) => {
            setReplyToMessage(nextMessage)
        })
    }, [client, replyToId])

    return (
        <div
            style={{
                display: 'flex',
                flexDirection: 'row',
                gap: CssVar.space(2)
            }}
        >
            <button
                type="button"
                onClick={() => navigate(`/profile/${encodeURIComponent(message.author)}`)}
                style={{ border: 'none', backgroundColor: 'transparent', cursor: 'pointer' }}
            >
                <Avatar ccid={message.author} src={message.authorProfile.avatar} />
            </button>
            <div
                style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: CssVar.space(2),
                    flex: 1,
                    minWidth: 0
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
                        onClick={() => navigate(`/profile/${encodeURIComponent(message.author)}`)}
                        style={{
                            border: 'none',
                            backgroundColor: 'transparent',
                            padding: 0,
                            fontWeight: 700,
                            cursor: 'pointer',
                            color: CssVar.contentText
                        }}
                    >
                        {message.authorProfile.username}
                    </button>
                    <button
                        type="button"
                        onClick={() => navigate(`/post/${encodeURIComponent(message.uri)}`)}
                        style={{
                            border: 'none',
                            backgroundColor: 'transparent',
                            padding: 0,
                            cursor: 'pointer',
                            color: CssVar.contentText,
                            opacity: 0.72
                        }}
                    >
                        <Text variant="caption">{formatTimestamp(message.createdAt)}</Text>
                    </button>
                </div>

                {replyToMessage && (
                    <button
                        type="button"
                        onClick={() => navigate(`/post/${encodeURIComponent(replyToId)}`)}
                        style={{
                            border: `1px solid ${CssVar.divider}`,
                            borderRadius: CssVar.round(1),
                            backgroundColor: 'transparent',
                            padding: CssVar.space(2),
                            textAlign: 'left',
                            cursor: 'pointer',
                            color: CssVar.contentText
                        }}
                    >
                        <Text variant="caption">返信先: {replyToMessage.authorProfile.username}</Text>
                        {'body' in (replyToMessage.value as Record<string, unknown>) && (
                            <Text>{String((replyToMessage.value as Record<string, unknown>).body ?? '')}</Text>
                        )}
                    </button>
                )}

                <CfmRenderer messagebody={message.value.body} emojiDict={{}} />
                <MessageDestinations message={message} />
                <MessageActions message={message} />
            </div>
        </div>
    )
}
