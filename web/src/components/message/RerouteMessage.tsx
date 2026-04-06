import { useEffect, useState } from 'react'
import { useClient } from '../../contexts/Client'
import { type MessageProps } from './types'
import { type RerouteMessageSchema, Message } from '@concrnt/worldlib'

import { Avatar, CfmRenderer, IconButton } from '@concrnt/ui'

import { MdMoreHoriz } from 'react-icons/md'
import { MdRepeat } from 'react-icons/md'
import { MessageActions } from './MessageActions'

export const RerouteMessage = (props: MessageProps<RerouteMessageSchema>) => {
    const { client } = useClient()

    const message = props.message

    // リルート元のメッセージ情報
    const rerouteId = message.value.rerouteMessageId
    // const rerouteAuthor = message.value.rerouteMessageAuthor

    // リルート元のメッセージを取得
    const [rerouteMessage, setRerouteMessage] = useState<Message<any> | null>(null)

    useEffect(() => {
        if (rerouteId && client) {
            client.getMessage<any>(rerouteId).then((msg) => {
                setRerouteMessage(msg)
            })
        }
    }, [rerouteId, client])

    return (
        <div
            style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '4px',
                contentVisibility: 'auto'
            }}
        >
            {/* リルートしたユーザーのヘッダー */}
            <div
                style={{
                    display: 'flex',
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: '4px',
                    fontSize: '12px',
                    opacity: 0.7,
                    paddingLeft: '48px'
                }}
            >
                <MdRepeat size={14} />
                <span>
                    {message.authorUser?.profile.username} がリルート
                </span>
                <div style={{ flex: 1 }} />
                <IconButton
                    style={{
                        padding: 0,
                        margin: 0
                    }}
                >
                    <MdMoreHoriz size={15} />
                </IconButton>
            </div>

            {/* リルート元のメッセージを表示 */}
            {rerouteMessage && (
                <div
                    style={{
                        display: 'flex',
                        flexDirection: 'row',
                        gap: '8px',
                        cursor: 'pointer'
                    }}
                >
                    <Avatar ccid={rerouteMessage.author} src={rerouteMessage.authorUser?.profile.avatar} />
                    <div
                        style={{
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '4px',
                            flex: 1
                        }}
                    >
                        <div
                            style={{
                                fontWeight: 'bold'
                            }}
                        >
                            {rerouteMessage.authorUser?.profile.username}
                        </div>
                        <CfmRenderer messagebody={rerouteMessage.value.body} emojiDict={{}} />
                        <MessageActions message={message} />
                    </div>
                </div>
            )}

            {/* ローディング中 */}
            {!rerouteMessage && rerouteId && <div style={{ paddingLeft: '48px', opacity: 0.5 }}>読み込み中...</div>}
        </div>
    )
}
