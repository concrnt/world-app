import { Suspense } from 'react'
import { useTranslation } from 'react-i18next'
import { MdCheckCircle } from 'react-icons/md'
import { Message, semantics } from '@concrnt/worldlib'
import { CssVar } from '@concrnt/ui'
import { useClient } from '../../contexts/Client'
import { useSubscribe } from '../../hooks/useSubscribe'

interface Props {
    message: Message<any>
}

const FollowingBadge = (props: { ccid: string }) => {
    const { t } = useTranslation('', { keyPrefix: 'components.acknowledgeButton' })
    const { client } = useClient()
    const [acknowledging] = useSubscribe(client.acknowledging)
    const following = acknowledging.some((a) => a.associate === semantics.user(props.ccid))
    if (!following) return null
    return <MdCheckCircle size={14} style={{ opacity: 0.7, flexShrink: 0 }} title={t('following')} />
}

export const MessageAuthor = (props: Props) => {
    const { client } = useClient()
    const message = props.message
    return (
        <span
            style={{
                display: 'flex',
                alignItems: 'center',
                gap: CssVar.space(1),
                overflow: 'hidden',
                whiteSpace: 'nowrap'
            }}
        >
            <span
                style={{
                    fontWeight: 'bold',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis'
                }}
            >
                {message.authorProfile?.username || 'Anonymous'}
            </span>
            {client.ccid && client.ccid !== message.author && (
                <Suspense fallback={null}>
                    <FollowingBadge ccid={message.author} />
                </Suspense>
            )}
            {message.authorUser?.alias && (
                <span style={{ fontSize: '0.75rem', opacity: 0.7, flexShrink: 0 }}>@{message.authorUser.alias}</span>
            )}
        </span>
    )
}
