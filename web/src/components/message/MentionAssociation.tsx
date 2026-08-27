import { useTranslation } from 'react-i18next'
import { MessageProps } from './types'
import { MentionAssociationSchema } from '@concrnt/worldlib'
import { Avatar } from '@concrnt/ui'
import { useNavigate } from 'react-router-dom'
import { MdAlternateEmail } from 'react-icons/md'
import { MessageContainer } from './main'

export const MentionAssociation = (props: MessageProps<MentionAssociationSchema>) => {
    const { t } = useTranslation('', { keyPrefix: 'components.mentionAssociation' })
    const navigate = useNavigate()
    const message = props.message

    // メンションされた投稿(APブリッジ経由の場合はap/noteレコード)
    const mentionSourceURI = message.associate

    return (
        <div
            style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '4px',
                cursor: 'pointer'
            }}
            onClick={() => {
                if (mentionSourceURI) {
                    navigate('/post/' + encodeURIComponent(mentionSourceURI))
                }
            }}
        >
            {/* 上部: メンションしたユーザーの情報 */}
            <div
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    fontSize: '12px',
                    opacity: 0.7,
                    paddingLeft: '56px'
                }}
            >
                <Avatar
                    ccid={message.author}
                    src={message.authorProfile?.avatar}
                    style={{ width: '16px', height: '16px' }}
                />
                <MdAlternateEmail size={14} />
                <span>{t('userMentioned', { name: message.authorProfile?.username ?? '' })}</span>
            </div>

            {/* 下部: メンション元の投稿 */}
            {mentionSourceURI && (
                <MessageContainer uri={mentionSourceURI} hint={message.authorUser?.domain ?? message.hint} />
            )}

            {/* ローディング */}
            {!mentionSourceURI && (
                <div style={{ paddingLeft: '56px', opacity: 0.5, fontSize: '12px' }}>{t('loading')}</div>
            )}
        </div>
    )
}
