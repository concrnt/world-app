import { useEffect, useState } from 'react'
import { useClient } from '../../contexts/Client'
import { useStack } from '../../layouts/Stack'
import { MessageProps } from './types'
import { RerouteMessageSchema, Message } from '@concrnt/worldlib'

import { ProfileView } from '../../views/Profile'
import { PostView } from '../../views/Post'

import { Avatar, CfmRenderer, Text, IconButton } from '@concrnt/ui'

import { MdMoreHoriz } from 'react-icons/md'
import { MdRepeat } from 'react-icons/md'
import { useSelect } from '../../contexts/Select'
import { MessageActions } from './MessageActions'
import { hapticSuccess } from '../../utils/haptics'

export const RerouteMessage = (props: MessageProps<RerouteMessageSchema>) => {
    const { push } = useStack()
    const { client } = useClient()
    const { select } = useSelect()

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
                <span
                    onClick={(e) => {
                        e.stopPropagation()
                        push(<ProfileView id={message.author} />)
                    }}
                    style={{ cursor: 'pointer' }}
                >
                    {message.authorUser?.profile.username} がリルート
                </span>
                <div style={{ flex: 1 }} />
                <IconButton
                    onClick={(e) => {
                        e.stopPropagation()
                        select(
                            '',
                            {
                                delete: <Text>リルートを削除</Text>
                            },
                            (key) => {
                                if (key === 'delete') {
                                    client?.api.delete(message.uri).then(() => hapticSuccess())
                                }
                            }
                        )
                    }}
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
                    onClick={(e) => {
                        e.stopPropagation()
                        push(<PostView uri={rerouteId} />)
                    }}
                >
                    <div
                        onClick={(e) => {
                            e.stopPropagation()
                            push(<ProfileView id={rerouteMessage.author} />)
                        }}
                    >
                        <Avatar ccid={rerouteMessage.author} src={rerouteMessage.authorUser?.profile.avatar} />
                    </div>
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
