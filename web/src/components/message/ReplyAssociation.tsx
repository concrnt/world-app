import { useEffect, useState } from 'react'
import { MessageProps } from './types'
import { ReplyAssociationSchema, Message } from '@concrnt/worldlib'
import { Avatar, CfmRenderer, Chip } from '@concrnt/ui'
import { useClient } from '../../contexts/Client'
import { useNavigate } from 'react-router-dom'
import { MdReply } from 'react-icons/md'
import { MessageLayout } from './MessageLayout'

export const ReplyAssociation = (props: MessageProps<ReplyAssociationSchema>) => {
    const navigate = useNavigate()
    const { client } = useClient()
    const message = props.message

    // アソシエーションのターゲット（リプライされた元の投稿）
    const targetMessage = message.associationTarget

    // リプライしたユーザー
    const replyAuthor = message.authorUser

    // リプライメッセージのURI（valueから取得）
    const replyMessageURI = message.value.targetURI

    // リプライメッセージを取得
    const [replyMessage, setReplyMessage] = useState<Message<any> | null>(null)

    useEffect(() => {
        if (replyMessageURI && client) {
            client.getMessage<any>(replyMessageURI).then((msg) => {
                setReplyMessage(msg)
            })
        }
    }, [replyMessageURI, client])

    return (
        <div
            style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '4px',
                cursor: 'pointer'
            }}
            onClick={() => {
                if (replyMessageURI) {
                    navigate('/post/' + encodeURIComponent(replyMessageURI))
                }
            }}
        >
            {/* 元の投稿（リプライされた側）を小さく表示 */}
            {targetMessage && (
                <div
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        fontSize: '12px',
                        opacity: 0.7,
                        paddingLeft: '48px',
                        overflow: 'hidden',
                        whiteSpace: 'nowrap',
                        textOverflow: 'ellipsis'
                    }}
                    onClick={(e) => {
                        e.stopPropagation()
                        navigate('/post/' + encodeURIComponent(targetMessage.uri))
                    }}
                >
                    <Avatar
                        ccid={targetMessage.author}
                        src={targetMessage.authorUser?.profile.avatar}
                        style={{ width: '16px', height: '16px' }}
                    />
                    <span>{targetMessage.value.body}</span>
                </div>
            )}

            {/* リプライメッセージを表示 */}
            {replyMessage && (
                <MessageLayout
                    onClick={() => {
                        if (replyMessageURI) {
                            navigate('/post/' + encodeURIComponent(replyMessageURI))
                        }
                    }}
                    left={
                        <div
                            onClick={(e) => {
                                e.stopPropagation()
                                if (replyAuthor) {
                                    navigate('/profile/' + replyAuthor.ccid)
                                }
                            }}
                        >
                            <Avatar ccid={message.author} src={replyAuthor?.profile.avatar} />
                        </div>
                    }
                    headerLeft={<div style={{ fontWeight: 'bold' }}>{replyAuthor?.profile.username}</div>}
                >
                    <Chip headElement={<MdReply size={12} />}>
                        {targetMessage?.authorUser?.profile.username || 'Unknown'}
                    </Chip>
                    <CfmRenderer messagebody={replyMessage.value.body} emojiDict={{}} />
                </MessageLayout>
            )}

            {/* ローディング */}
            {!replyMessage && replyMessageURI && (
                <div style={{ paddingLeft: '48px', opacity: 0.5, fontSize: '12px' }}>読み込み中...</div>
            )}
        </div>
    )
}
