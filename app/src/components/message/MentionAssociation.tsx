import { useTranslation } from 'react-i18next'
import { MessageProps } from './types'
import { MentionAssociationSchema } from '@concrnt/worldlib'
import { Avatar } from '@concrnt/ui'
import { useStack } from '../../layouts/Stack'
import { PostView } from '../../views/Post'
import { MdAlternateEmail } from 'react-icons/md'
import { MessageContainer } from './main'

export const MentionAssociation = (props: MessageProps<MentionAssociationSchema>) => {
    const { t } = useTranslation('', { keyPrefix: 'components.mentionAssociation' })
    const { push } = useStack()
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
                    push(<PostView uri={mentionSourceURI} />)
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
                    paddingLeft: '48px'
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
                <div style={{ paddingLeft: '48px', opacity: 0.5, fontSize: '12px' }}>{t('loading')}</div>
            )}
        </div>
    )
}
