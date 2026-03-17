import { useEffect, useState } from 'react'
import { useClient } from '../../contexts/Client'
import { useStack } from '../../layouts/Stack'
import { MessageProps } from './types'
import { RerouteMessageSchema, Schemas, Message } from '@concrnt/worldlib'

import { ProfileView } from '../../views/Profile'
import { PostView } from '../../views/Post'

import { Avatar, Button, CfmRenderer, Text, IconButton } from '@concrnt/ui'

import { MdMoreHoriz } from 'react-icons/md'
import { MdStar } from 'react-icons/md'
import { MdStarOutline } from 'react-icons/md'
import { MdReply } from 'react-icons/md'
import { MdRepeat } from 'react-icons/md'
import { useSelect } from '../../contexts/Select'
import { useComposer } from '../../contexts/Composer'

export const RerouteMessage = (props: MessageProps<RerouteMessageSchema>) => {
    const { push } = useStack()
    const { client } = useClient()
    const { select } = useSelect()
    const composer = useComposer()

    const message = props.message

    /*
    const ownFavorite = message.ownAssociations.find((a) => a.schema === Schemas.likeAssociation)
    const likeCount = message.associationCounts?.[Schemas.likeAssociation] ?? 0
    const replyCount = message.associationCounts?.[Schemas.replyAssociation] ?? 0
    const rerouteCount = message.associationCounts?.[Schemas.rerouteAssociation] ?? 0
    */

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
                                    client?.api.delete(message.uri)
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
                        <div
                            style={{
                                display: 'flex',
                                flexDirection: 'row',
                                gap: '8px',
                                alignItems: 'center'
                            }}
                        >
                            {/* リプライボタン */}
                            <Button
                                variant="text"
                                onClick={(e) => {
                                    e.stopPropagation()
                                    composer.open([], [], 'reply', rerouteMessage)
                                }}
                                style={{ display: 'flex', alignItems: 'center' }}
                            >
                                <MdReply size={20} />
                                {(rerouteMessage.associationCounts?.[Schemas.replyAssociation] ?? 0) > 0 && (
                                    <span style={{ marginLeft: '4px' }}>
                                        {rerouteMessage.associationCounts?.[Schemas.replyAssociation]}
                                    </span>
                                )}
                            </Button>

                            {/* リルートボタン */}
                            <Button
                                variant="text"
                                onClick={(e) => {
                                    e.stopPropagation()
                                    composer.open([], [], 'reroute', rerouteMessage)
                                }}
                                style={{ display: 'flex', alignItems: 'center' }}
                            >
                                <MdRepeat size={20} />
                                {(rerouteMessage.associationCounts?.[Schemas.rerouteAssociation] ?? 0) > 0 && (
                                    <span style={{ marginLeft: '4px' }}>
                                        {rerouteMessage.associationCounts?.[Schemas.rerouteAssociation]}
                                    </span>
                                )}
                            </Button>

                            {/* いいねボタン */}
                            <Button
                                variant="text"
                                onClick={(e) => {
                                    e.stopPropagation()
                                    if (!client) return
                                    const ownFav = rerouteMessage.ownAssociations.find(
                                        (a) => a.schema === Schemas.likeAssociation
                                    )
                                    if (ownFav) {
                                        //client?.unfavorite(rerouteMessage)
                                    } else {
                                        rerouteMessage.favorite(client)
                                    }
                                }}
                                style={{ display: 'flex', alignItems: 'center' }}
                            >
                                {rerouteMessage.ownAssociations.find((a) => a.schema === Schemas.likeAssociation) ? (
                                    <MdStar size={20} color="gold" />
                                ) : (
                                    <MdStarOutline size={20} />
                                )}
                                <span style={{ marginLeft: '4px' }}>
                                    {rerouteMessage.associationCounts?.[Schemas.likeAssociation] ?? 0}
                                </span>
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {/* ローディング中 */}
            {!rerouteMessage && rerouteId && <div style={{ paddingLeft: '48px', opacity: 0.5 }}>読み込み中...</div>}
        </div>
    )
}
