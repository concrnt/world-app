import { useTranslation } from 'react-i18next'
import { MessageProps } from './types'
import { RerouteAssociationSchema } from '@concrnt/worldlib'
import { Avatar, CfmRenderer } from '@concrnt/ui'
import { useNavigate } from 'react-router-dom'
import { MdRepeat } from 'react-icons/md'
import { MessageLayout } from './MessageLayout'

export const RerouteAssociation = (props: MessageProps<RerouteAssociationSchema>) => {
    const { t } = useTranslation('', { keyPrefix: 'components.rerouteAssociation' })
    const navigate = useNavigate()
    const message = props.message

    // アソシエーションのターゲット（リルートされた元の投稿）
    const targetMessage = message.associationTarget

    // リルートしたユーザー
    const rerouteAuthor = message.authorUser

    // リルートメッセージのURI（valueから取得）
    const rerouteMessageURI = message.value.targetURI

    return (
        <div
            style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '4px',
                cursor: 'pointer'
            }}
            onClick={() => {
                if (rerouteMessageURI) {
                    navigate('/post/' + encodeURIComponent(rerouteMessageURI))
                }
            }}
        >
            {/* 上部: リルートしたユーザーの情報 */}
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
                    src={rerouteAuthor?.profile.avatar}
                    style={{ width: '16px', height: '16px' }}
                />
                <MdRepeat size={14} />
                <span
                    onClick={(e) => {
                        e.stopPropagation()
                        if (rerouteAuthor) {
                            navigate('/profile/' + rerouteAuthor.ccid)
                        }
                    }}
                    style={{ cursor: 'pointer' }}
                >
                    {t('userRerouted', { name: rerouteAuthor?.profile.username ?? '' })}
                </span>
            </div>

            {/* 下部: 元の投稿 */}
            {targetMessage && (
                <MessageLayout
                    onClick={() => {
                        navigate('/post/' + encodeURIComponent(targetMessage.uri))
                    }}
                    left={
                        <div
                            onClick={(e) => {
                                e.stopPropagation()
                                navigate('/profile/' + targetMessage.author)
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
            {!targetMessage && (
                <div style={{ paddingLeft: '48px', opacity: 0.5, fontSize: '12px' }}>{t('loading')}</div>
            )}
        </div>
    )
}
