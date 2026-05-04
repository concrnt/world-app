import { useEffect, useState } from 'react'
import { Avatar, CfmRenderer, CssVar, Text } from '@concrnt/ui'
import { useNavigate } from 'react-router-dom'
import { type Message, type ReplyAssociationSchema } from '@concrnt/worldlib'
import { useClient } from '../../contexts/Client'
import type { MessageProps } from './types'
import { formatTimestamp } from './common'

export const ReplyAssociation = (props: MessageProps<ReplyAssociationSchema>) => {
    const { client } = useClient()
    const navigate = useNavigate()
    const message = props.message
    const replyMessageId = message.value.messageId
    const [replyMessage, setReplyMessage] = useState<Message<unknown> | null>(null)

    useEffect(() => {
        if (!replyMessageId || !client) return
        void client.getMessage<unknown>(replyMessageId).then((nextMessage) => {
            setReplyMessage(nextMessage)
        })
    }, [client, replyMessageId])

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
                <Text variant="caption">{message.authorProfile.username} が返信しました</Text>
                <Text variant="caption">{formatTimestamp(message.createdAt)}</Text>
            </div>
            {replyMessage && (
                <div
                    style={{
                        display: 'flex',
                        flexDirection: 'row',
                        gap: CssVar.space(2)
                    }}
                >
                    <button
                        type="button"
                        onClick={() => navigate(`/profile/${encodeURIComponent(replyMessage.author)}`)}
                        style={{ border: 'none', backgroundColor: 'transparent', cursor: 'pointer' }}
                    >
                        <Avatar ccid={replyMessage.author} src={replyMessage.authorProfile.avatar} />
                    </button>
                    <button
                        type="button"
                        onClick={() => navigate(`/post/${encodeURIComponent(replyMessage.uri)}`)}
                        style={{
                            border: 'none',
                            backgroundColor: 'transparent',
                            textAlign: 'left',
                            padding: 0,
                            cursor: 'pointer',
                            color: CssVar.contentText,
                            flex: 1
                        }}
                    >
                        <Text>{replyMessage.authorProfile.username}</Text>
                        {'body' in (replyMessage.value as Record<string, unknown>) && (
                            <CfmRenderer
                                messagebody={String((replyMessage.value as Record<string, unknown>).body ?? '')}
                                emojiDict={{}}
                            />
                        )}
                    </button>
                </div>
            )}
        </div>
    )
}
