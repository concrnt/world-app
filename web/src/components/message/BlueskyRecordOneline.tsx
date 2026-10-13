import { Suspense, use, useMemo } from 'react'
import { BskyPostView } from '../../utils/bluesky'
import { Avatar, Skeleton, Text } from '@concrnt/ui'
import { TimeDiff } from '../TimeDiff'
import { useNavigate } from 'react-router-dom'
import { useClient } from '../../contexts/Client'
import { AtprotoRecordSchema, Message } from '@concrnt/worldlib'
import { useTranslation } from 'react-i18next'
import { OnelineMessageLayout } from './OnelineLayout'
import { Timestamp } from './Timestamp'
import { MessageContainer } from './main'

interface Props {
    atUri: string
    // concrnt側のレコード(atproto/record)があれば渡す。無い場合(Bluesky投稿のリプライ先など)は
    // 投稿自身のcreatedAtを時刻に使い、遷移先はBskyViewになる
    message?: Message<AtprotoRecordSchema>
}

const onelineSkeleton = (
    <OnelineMessageLayout left={<Skeleton style={{ width: '48px', height: '18px' }} />}>
        <Skeleton style={{ flex: 1, height: '1em' }} />
    </OnelineMessageLayout>
)

// リプライ元などの1行表示用。BlueskyRecordと同じ解決経路(ブリッジのresolve)で投稿を引き、本文を1行で流す。
// ブリッジが輸出したconcrnt投稿(resolveがconcrntURIを返す)なら、ActivitypubNoteのinReplyToがブリッジURLの場合と
// 同じくネイティブのonelineに委譲する
export const BlueskyRecordOneline = (props: Props) => {
    const { client } = useClient()
    const atUri = props.atUri

    const postPromise = useMemo(() => {
        return client.api
            .callConcrntApi<BskyPostView>(client.server.domain, 'world.concrnt.atproto.resolve', { uri: atUri })
            .catch(() => null)
    }, [client, atUri])

    return (
        <Suspense fallback={onelineSkeleton}>
            <Post postPromise={postPromise} atUri={atUri} message={props.message} />
        </Suspense>
    )
}

const Post = (props: {
    postPromise: Promise<BskyPostView | null>
    atUri: string
    message?: Message<AtprotoRecordSchema>
}) => {
    const { t } = useTranslation('', { keyPrefix: 'components.blueskyRecord' })
    const navigate = useNavigate()

    const post = use(props.postPromise)

    if (post?.concrntURI) {
        return (
            <Suspense fallback={onelineSkeleton}>
                <MessageContainer oneline uri={post.concrntURI} />
            </Suspense>
        )
    }

    const date = props.message?.createdAt ?? (post?.record.createdAt ? new Date(post.record.createdAt) : null)

    return (
        <OnelineMessageLayout
            left={
                <div
                    onClick={(e) => {
                        e.stopPropagation()
                        if (post) navigate('/bluesky/view/' + encodeURIComponent(post.author.did))
                    }}
                >
                    <Avatar
                        ccid={post?.author.did ?? ''}
                        src={post?.author.avatar}
                        style={{ width: '48px', height: '18px' }}
                    />
                </div>
            }
        >
            {!post ? (
                <Text style={{ opacity: 0.7 }}>{t('notFound')}</Text>
            ) : (
                <Text
                    style={{
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap'
                    }}
                >
                    {post.record.text ?? ''}
                </Text>
            )}
            <div style={{ flex: 1 }} />
            {date && (
                <Timestamp
                    onClick={() => {
                        // concrnt側のメッセージがあればネイティブ同等の詳細ビューへ。無ければat-uriでBskyViewへ
                        if (props.message) {
                            navigate('/post/' + encodeURIComponent(props.message.uri))
                        } else {
                            navigate('/bluesky/view/' + encodeURIComponent(props.atUri))
                        }
                    }}
                >
                    <TimeDiff date={date} />
                </Timestamp>
            )}
        </OnelineMessageLayout>
    )
}
