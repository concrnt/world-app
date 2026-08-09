import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { MessageProps } from './types'
import { FollowAckSchema, User } from '@concrnt/worldlib'
import { Avatar } from '@concrnt/ui'
import { useStack } from '../../layouts/Stack'
import { ProfileView } from '../../views/Profile'
import { MdPersonAdd } from 'react-icons/md'
import { MessageLayout } from './MessageLayout'
import { useClient } from '../../contexts/Client'

export const FollowAck = (props: MessageProps<FollowAckSchema>) => {
    const { t } = useTranslation('', { keyPrefix: 'components.followAck' })
    const { push } = useStack()
    const { client } = useClient()
    const message = props.message

    // フォローしたユーザー
    const followAuthor = message.authorUser

    // フォローされた相手 (associate はユーザーURIなので associationTarget には入らない)
    const [followee, setFollowee] = useState<User | null>(null)
    useEffect(() => {
        if (!client || !message.associate) return
        client.getUser(message.associate).then(setFollowee)
    }, [client, message.associate])

    return (
        <div
            style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '4px',
                cursor: 'pointer'
            }}
            onClick={() => {
                if (followee) {
                    push(<ProfileView ccid={followee.ccid} />)
                }
            }}
        >
            {/* 上部: フォローしたユーザーの情報 */}
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
                <MdPersonAdd size={14} />
                <span
                    onClick={(e) => {
                        e.stopPropagation()
                        if (followAuthor) {
                            push(<ProfileView ccid={followAuthor.ccid} />)
                        }
                    }}
                    style={{ cursor: 'pointer' }}
                >
                    {t('userFollowed', { name: message.authorProfile?.username ?? '' })}
                </span>
            </div>

            {/* 下部: フォローされた相手 */}
            {followee && (
                <MessageLayout
                    onClick={() => {
                        push(<ProfileView ccid={followee.ccid} />)
                    }}
                    left={
                        <Avatar
                            ccid={followee.ccid}
                            src={followee.profile.avatar}
                            style={{ width: '48px', height: '48px' }}
                        />
                    }
                    headerLeft={<div style={{ fontWeight: 'bold' }}>{followee.profile.username}</div>}
                />
            )}

            {/* ローディング */}
            {!followee && <div style={{ paddingLeft: '56px', opacity: 0.5, fontSize: '12px' }}>{t('loading')}</div>}
        </div>
    )
}
