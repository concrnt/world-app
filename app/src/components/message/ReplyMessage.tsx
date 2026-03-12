import { useEffect, useState } from 'react'
import { useClient } from '../../contexts/Client'
import { useStack } from '../../layouts/Stack'
import { MessageProps } from './types'
import { ReplyMessageSchema, Schemas, Message } from '@concrnt/worldlib'

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
import { CssVar } from '../../types/Theme'

export const ReplyMessage = (props: MessageProps<ReplyMessageSchema>) => {
    const { push } = useStack()
    const { client } = useClient()
    const { select } = useSelect()
    const composer = useComposer()

    const message = props.message

    const ownFavorite = message.ownAssociations.find((a) => a.schema === Schemas.likeAssociation)
    const likeCount = message.associationCounts?.[Schemas.likeAssociation] ?? 0
    const replyCount = message.associationCounts?.[Schemas.replyAssociation] ?? 0
    const rerouteCount = message.associationCounts?.[Schemas.rerouteAssociation] ?? 0

    // リプライ先のメッセージ情報
    const replyToId = message.value.replyToMessageId

    // リプライ先のメッセージを取得
    const [replyToMessage, setReplyToMessage] = useState<Message<any> | null>(null)

    useEffect(() => {
        if (replyToId && client) {
            client.getMessage<any>(replyToId).then((msg) => {
                setReplyToMessage(msg)
            })
        }
    }, [replyToId, client])

    return (
        <div
            style={{
                display: 'flex',
                flexDirection: 'row',
                gap: '8px',
                contentVisibility: 'auto'
            }}
            onClick={(e) => {
                e.stopPropagation()
                push(<PostView uri={message.uri} />)
            }}
        >
            <div
                onClick={(e) => {
                    e.stopPropagation()
                    push(<ProfileView id={message.author} />)
                }}
            >
                <Avatar ccid={message.author} src={message.authorUser?.profile.avatar} />
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
                        display: 'flex',
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '8px'
                    }}
                >
                    <div
                        style={{
                            fontWeight: 'bold'
                        }}
                    >
                        {message.authorUser?.profile.username}
                    </div>
                    <IconButton
                        onClick={(e) => {
                            e.stopPropagation()
                            select(
                                '',
                                {
                                    delete: <Text>投稿を削除</Text>
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

                {/* リプライ先の引用表示 */}
                {replyToMessage && (
                    <div
                        style={{
                            padding: '8px',
                            backgroundColor: CssVar.backdropBackground,
                            borderRadius: '4px',
                            borderLeft: '3px solid',
                            borderLeftColor: CssVar.contentLink,
                            fontSize: '12px',
                            cursor: 'pointer'
                        }}
                        onClick={(e) => {
                            e.stopPropagation()
                            push(<PostView uri={replyToId} />)
                        }}
                    >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '4px' }}>
                            <MdReply size={12} />
                            <Avatar
                                ccid={replyToMessage.author}
                                src={replyToMessage.authorUser?.profile.avatar}
                                style={{ width: '16px', height: '16px' }}
                            />
                            <span style={{ fontWeight: 'bold' }}>{replyToMessage.authorUser?.profile.username}</span>
                        </div>
                        <div
                            style={{
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                display: '-webkit-box',
                                WebkitLineClamp: 2,
                                WebkitBoxOrient: 'vertical'
                            }}
                        >
                            <CfmRenderer messagebody={replyToMessage.value.body} emojiDict={{}} />
                        </div>
                    </div>
                )}

                <CfmRenderer messagebody={message.value.body} emojiDict={{}} />
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
                            composer.open([], [], 'reply', message)
                        }}
                        style={{ display: 'flex', alignItems: 'center' }}
                    >
                        <MdReply size={20} />
                        {replyCount > 0 && <span style={{ marginLeft: '4px' }}>{replyCount}</span>}
                    </Button>

                    {/* リルートボタン */}
                    <Button
                        variant="text"
                        onClick={(e) => {
                            e.stopPropagation()
                            composer.open([], [], 'reroute', message)
                        }}
                        style={{ display: 'flex', alignItems: 'center' }}
                    >
                        <MdRepeat size={20} />
                        {rerouteCount > 0 && <span style={{ marginLeft: '4px' }}>{rerouteCount}</span>}
                    </Button>

                    {/* いいねボタン */}
                    <Button
                        variant="text"
                        onClick={(e) => {
                            e.stopPropagation()
                            if (!client) return
                            if (ownFavorite) {
                                //client?.unfavorite(message)
                            } else {
                                message.favorite(client)
                            }
                        }}
                        style={{ display: 'flex', alignItems: 'center' }}
                    >
                        {ownFavorite ? <MdStar size={20} color="gold" /> : <MdStarOutline size={20} />}
                        <span style={{ marginLeft: '4px' }}>{likeCount}</span>
                    </Button>
                </div>
            </div>
        </div>
    )
}
