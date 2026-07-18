import { useTranslation } from 'react-i18next'
import { MessageProps } from './types'
import { ReactionAssociationSchema } from '@concrnt/worldlib'
import { CCImage, Avatar, CfmRenderer } from '@concrnt/ui'
import { useNavigate } from 'react-router-dom'
import { MdEmojiEmotions } from 'react-icons/md'
import { MessageLayout } from './MessageLayout'

export const ReactionAssociation = (props: MessageProps<ReactionAssociationSchema>) => {
    const { t } = useTranslation('', { keyPrefix: 'components.reactionAssociation' })
    const navigate = useNavigate()
    const message = props.message

    const targetMessage = message.associationTarget
    const reactionAuthor = message.authorUser
    const reaction = message.value

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
                    navigate('/post/' + encodeURIComponent(targetMessage.uri))
                }
            }}
        >
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
                    src={reactionAuthor?.profile.avatar}
                    style={{ width: '16px', height: '16px' }}
                />
                {reaction?.imageUrl ? (
                    <CCImage
                        src={reaction.imageUrl}
                        maxHeight={128}
                        alt={reaction.shortcode ?? ''}
                        style={{
                            height: '16px',
                            flexShrink: 0
                        }}
                    />
                ) : (
                    <MdEmojiEmotions size={14} />
                )}
                <span
                    onClick={(e) => {
                        e.stopPropagation()
                        if (reactionAuthor) {
                            navigate('/profile/' + reactionAuthor.ccid)
                        }
                    }}
                    style={{ cursor: 'pointer' }}
                >
                    {t('userReacted', { name: reactionAuthor?.profile.username ?? '' })}
                </span>
            </div>

            {targetMessage && (
                <MessageLayout
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
                    <CfmRenderer messagebody={targetMessage.value.body} emojiDict={targetMessage.value.emojis ?? {}} />
                </MessageLayout>
            )}

            {!targetMessage && (
                <div style={{ paddingLeft: '48px', opacity: 0.5, fontSize: '12px' }}>{t('loading')}</div>
            )}
        </div>
    )
}
