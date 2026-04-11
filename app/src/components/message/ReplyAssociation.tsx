import { useEffect, useState } from 'react'
import { MessageProps } from './types'
import { ReplyAssociationSchema, Message } from '@concrnt/worldlib'
import { Avatar, CfmRenderer } from '@concrnt/ui'
import { useStack } from '../../layouts/Stack'
import { useClient } from '../../contexts/Client'
import { PostView } from '../../views/Post'
import { ProfileView } from '../../views/Profile'
import { MdReply } from 'react-icons/md'
import { CssVar } from '../../types/Theme'
import { MessageLayout } from './MessageLayout'

export const ReplyAssociation = (props: MessageProps<ReplyAssociationSchema>) => {
    const { push } = useStack()
    const { client } = useClient()
    const message = props.message

    // アソシエーションのターゲット（リプライされた元の投稿）
    const targetMessage = message.associationTarget

    // リプライしたユーザー
    const replyAuthor = message.authorUser

    // リプライメッセージのID（valueから取得）
    const replyMessageId = message.value.messageId

    // リプライメッセージを取得
    const [replyMessage, setReplyMessage] = useState<Message<any> | null>(null)

    useEffect(() => {
        if (replyMessageId && client) {
            client.getMessage<any>(replyMessageId).then((msg) => {
                setReplyMessage(msg)
            })
        }
    }, [replyMessageId, client])

    return (
        <div
            style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '4px',
                cursor: 'pointer'
            }}
            onClick={() => {
                if (replyMessageId) {
                    push(<PostView uri={replyMessageId} />)
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
                        push(<PostView uri={targetMessage.uri} />)
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
                        if (replyMessageId) {
                            push(<PostView uri={replyMessageId} />)
                        }
                    }}
                    left={
                        <div
                            onClick={(e) => {
                                e.stopPropagation()
                                if (replyAuthor) {
                                    push(<ProfileView id={replyAuthor.ccid} />)
                                }
                            }}
                        >
                            <Avatar ccid={message.author} src={replyAuthor?.profile.avatar} />
                        </div>
                    }
                    headerLeft={<div style={{ fontWeight: 'bold' }}>{replyAuthor?.profile.username}</div>}
                >
                    <div
                        style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            backgroundColor: CssVar.backdropBackground,
                            borderRadius: '4px',
                            padding: '2px 8px',
                            fontSize: '12px',
                            width: 'fit-content'
                        }}
                    >
                        <MdReply size={12} />
                        <span>{targetMessage?.authorUser?.profile.username}</span>
                    </div>
                    <CfmRenderer messagebody={replyMessage.value.body} emojiDict={{}} />
                </MessageLayout>
            )}

            {/* ローディング */}
            {!replyMessage && replyMessageId && (
                <div style={{ paddingLeft: '48px', opacity: 0.5, fontSize: '12px' }}>読み込み中...</div>
            )}
        </div>
    )
}
