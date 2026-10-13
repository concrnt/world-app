import { Suspense, use, useMemo } from 'react'
import { BskyPostView } from '../../utils/bluesky'
import { Avatar, CssVar, Text } from '@concrnt/ui'
import { useStack } from '../../layouts/Stack'
import { BskyView } from '../../views/BskyView'
import { useClient } from '../../contexts/Client'
import { MessageSkeleton } from './MessageSkeleton'
import { MessageLayout } from './MessageLayout'
import { RiBlueskyLine } from 'react-icons/ri'
import { useTranslation } from 'react-i18next'

interface Props {
    atUri: string
    onClick?: () => void
}

// Like/Reaction/RerouteAssociationの「対象投稿」カード(アバター+作者名+本文のみ、時刻やフッター無し)のBluesky投稿版。
// ActivitypubNoteCardと同じ見た目に揃え、作者名にはBlueskyRecordと同じBlueskyバッジ+@handleを出す
export const BlueskyRecordCard = (props: Props) => {
    const { client } = useClient()

    const postPromise = useMemo(() => {
        return client.api
            .callConcrntApi<BskyPostView>(client.server.domain, 'world.concrnt.atproto.resolve', { uri: props.atUri })
            .catch(() => null)
    }, [client, props.atUri])

    return (
        <Suspense fallback={<MessageSkeleton />}>
            <Card postPromise={postPromise} onClick={props.onClick} />
        </Suspense>
    )
}

const Card = (props: { postPromise: Promise<BskyPostView | null>; onClick?: () => void }) => {
    const { t } = useTranslation('', { keyPrefix: 'components.blueskyRecord' })
    const { push } = useStack()

    const post = use(props.postPromise)

    if (!post) {
        return (
            <div style={{ padding: CssVar.space(1), paddingLeft: '48px' }}>
                <Text style={{ opacity: 0.7, fontSize: '0.8rem' }}>{t('notFound')}</Text>
            </div>
        )
    }

    return (
        <MessageLayout
            onClick={props.onClick}
            left={
                <div
                    onClick={(e) => {
                        e.stopPropagation()
                        push(<BskyView uri={post.author.did} />)
                    }}
                >
                    <Avatar ccid={post.author.did} src={post.author.avatar} />
                </div>
            }
            headerLeft={
                <span
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: CssVar.space(1),
                        overflow: 'hidden',
                        whiteSpace: 'nowrap'
                    }}
                >
                    <Text
                        style={{
                            fontWeight: 'bold',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis'
                        }}
                    >
                        {post.author.displayName || post.author.handle}
                    </Text>
                    <RiBlueskyLine size={14} style={{ flexShrink: 0 }} title="Bluesky" />
                    <span
                        style={{
                            fontSize: '0.75rem',
                            opacity: 0.7,
                            flexShrink: 1000,
                            minWidth: 0,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis'
                        }}
                    >
                        @{post.author.handle}
                    </span>
                </span>
            }
        >
            <Text
                style={{
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word'
                }}
            >
                {post.record.text ?? ''}
            </Text>
        </MessageLayout>
    )
}
