import { type MessageProps } from './types'
import { type LikeAssociationSchema } from '@concrnt/worldlib'
import { Avatar, CfmRenderer } from '@concrnt/ui'
import { MdStar } from 'react-icons/md'

export const LikeAssociation = (props: MessageProps<LikeAssociationSchema>) => {
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
                    style={{ cursor: 'pointer' }}
                >
                    {likeAuthor?.profile.username} がお気に入りに登録しました
                </span>
            </div>

            {/* 下部: 元の投稿 */}
            {targetMessage && (
                <div
                    style={{
                        display: 'flex',
                        flexDirection: 'row',
                        gap: '8px'
                    }}
                >
                    <Avatar ccid={targetMessage.author} src={targetMessage.authorUser?.profile.avatar} />
                    <div
                        style={{
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '4px',
                            flex: 1
                        }}
                    >
                        <div style={{ fontWeight: 'bold' }}>{targetMessage.authorUser?.profile.username}</div>
                        <CfmRenderer messagebody={targetMessage.value.body} emojiDict={{}} />
                    </div>
                </div>
            )}

            {/* ローディング */}
            {!targetMessage && <div style={{ paddingLeft: '48px', opacity: 0.5, fontSize: '12px' }}>読み込み中...</div>}
        </div>
    )
}
