import { MessageProps } from './types'
import { LikeAssociationSchema } from '@concrnt/worldlib'
import { Avatar, CfmRenderer } from '@concrnt/ui'
import { useStack } from '../../layouts/Stack'
import { PostView } from '../../views/Post'
import { ProfileView } from '../../views/Profile'
import { MdStar } from 'react-icons/md'
import { MessageLayout } from './MessageLayout'

export const LikeAssociation = (props: MessageProps<LikeAssociationSchema>) => {
    const { push } = useStack()
    const message = props.message

    // アソシエーションのターゲット（お気に入り登録された投稿）
    const targetMessage = message.associationTarget

    // お気に入り登録したユーザー
    const likeAuthor = message.authorUser

    return (
        <div
            style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '4px',
                cursor: 'pointer'
            }}
            onClick={() => {
                if (targetMessage) {
                    push(<PostView uri={targetMessage.uri} />)
                }
            }}
        >
            {/* 上部: お気に入り登録したユーザーの情報 */}
            <div
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    fontSize: '12px',
                    opacity: 0.7,
                    paddingLeft: '48px'
                }}
            >
                <Avatar
                    ccid={message.author}
                    src={likeAuthor?.profile.avatar}
                    style={{ width: '16px', height: '16px' }}
                />
                <MdStar size={14} />
                <span
                    onClick={(e) => {
                        e.stopPropagation()
                        if (likeAuthor) {
                            push(<ProfileView ccid={likeAuthor.ccid} />)
                        }
                    }}
                    style={{ cursor: 'pointer' }}
                >
                    {likeAuthor?.profile.username} がお気に入りに登録しました
                </span>
            </div>

            {/* 下部: 元の投稿 */}
            {targetMessage && (
                <MessageLayout
                    left={
                        <div
                            onClick={(e) => {
                                e.stopPropagation()
                                push(<ProfileView ccid={targetMessage.author} />)
                            }}
                        >
                            <Avatar ccid={targetMessage.author} src={targetMessage.authorUser?.profile.avatar} />
                        </div>
                    }
                    headerLeft={<div style={{ fontWeight: 'bold' }}>{targetMessage.authorUser?.profile.username}</div>}
                >
                    <CfmRenderer messagebody={targetMessage.value.body} emojiDict={{}} />
                </MessageLayout>
            )}

            {/* ローディング */}
            {!targetMessage && <div style={{ paddingLeft: '48px', opacity: 0.5, fontSize: '12px' }}>読み込み中...</div>}
        </div>
    )
}
