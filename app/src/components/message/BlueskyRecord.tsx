import { Suspense, use, useMemo } from 'react'
import { BskyPostView, getPostMedias, getPostExternal, bskyPostUrl, bskyPostUrlFromAtUri } from '../../utils/bluesky'
import { useStack } from '../../layouts/Stack'
import { MessageLayout } from './MessageLayout'
import { Avatar, CssVar, Text } from '@concrnt/ui'
import { ExternalLink } from '../ExternalLink'
import { TimeDiff } from '../TimeDiff'
import { BskyView } from '../../views/BskyView'
import { PostView } from '../../views/Post'
import { useClient } from '../../contexts/Client'
import { MessageSkeleton } from './MessageSkeleton'
import { AtprotoRecordSchema, Message, RerouteMessageSchema } from '@concrnt/worldlib'
import { MessageFooter } from './Footer'
import { RiBlueskyLine } from 'react-icons/ri'
import { MdOpenInNew } from 'react-icons/md'
import { useTranslation } from 'react-i18next'
import { ErrorBoundary } from 'react-error-boundary'
import { RenderError } from './RenderError'
import { BlueskyRecordOneline } from './BlueskyRecordOneline'
import { BskyRichText } from './BskyRichText'
import { MediaGallery } from '../MediaGallery/main'
import { UrlEmbed } from '../AutoSummary'
import { TranslatableBody } from './TranslatableBody'
import { RenderedBody } from './RenderedBody'
import { MessageTranslationProvider } from '../../contexts/MessageTranslation'
import { RenderedBodyProvider } from '../../contexts/RenderedBody'

interface Props {
    atUri: string
    // 一覧(author feed)で既に取得済みのpost view。渡されたときはブリッジのresolveを呼ばない
    post?: BskyPostView
    message?: Message<AtprotoRecordSchema>
    detail?: boolean
    rerouted?: Message<RerouteMessageSchema>
}

export const BlueskyRecord = (props: Props) => {
    const { client } = useClient()

    const postPromise = useMemo(() => {
        if (props.post) return Promise.resolve(props.post)
        return client.api
            .callConcrntApi<BskyPostView>(client.server.domain, 'world.concrnt.atproto.resolve', { uri: props.atUri })
            .catch(() => null)
    }, [client, props.atUri, props.post])

    return (
        <Suspense fallback={<MessageSkeleton />}>
            <Post
                atUri={props.atUri}
                postPromise={postPromise}
                message={props.message}
                detail={props.detail}
                rerouted={props.rerouted}
            />
        </Suspense>
    )
}

// ActivitypubNote の「リモートで開く」と同じ見た目
const openRemoteStyle = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: CssVar.space(1),
    fontSize: '0.8rem',
    color: CssVar.contentLink,
    textDecoration: 'none'
} as const

const Post = (props: {
    atUri: string
    postPromise: Promise<BskyPostView | null>
    message?: Message<AtprotoRecordSchema>
    detail?: boolean
    rerouted?: Message<RerouteMessageSchema>
}) => {
    const { push } = useStack()
    const { t } = useTranslation('', { keyPrefix: 'components.blueskyRecord' })

    const post = use(props.postPromise)

    if (!post) {
        // ブリッジで解決できなくても元の投稿自体は bsky.app に残っている場合があるので、AP同様に導線だけ出す
        const fallbackUrl = bskyPostUrlFromAtUri(props.atUri)
        return (
            <div
                style={{
                    padding: CssVar.space(2),
                    display: 'flex',
                    flexDirection: 'column',
                    gap: CssVar.space(1)
                }}
            >
                <Text>{t('notFound')}</Text>
                {fallbackUrl && (
                    <ExternalLink href={fallbackUrl} style={openRemoteStyle}>
                        <MdOpenInNew size={14} />
                        {t('openRemote')}
                    </ExternalLink>
                )}
            </div>
        )
    }

    const medias = getPostMedias(post)
    const external = getPostExternal(post)
    const postUrl = bskyPostUrl(post)
    // ネイティブのReplyMessage/ActivitypubNoteと同じく、リプライ元を1行表示で上に出す
    const replyParent = post.record.reply?.parent?.uri

    return (
        <div
            style={{
                display: 'flex',
                flexDirection: 'column'
            }}
        >
            {replyParent && (
                <ErrorBoundary FallbackComponent={RenderError}>
                    <BlueskyRecordOneline atUri={replyParent} />
                </ErrorBoundary>
            )}
            <MessageLayout
                detail={props.detail}
                onClick={() => {
                    // concrnt側のメッセージがあればネイティブ同等の詳細ビュー(リプライ/リアクション一覧付き)へ
                    if (props.message) {
                        push(<PostView uri={props.message.uri} />)
                    } else {
                        push(<BskyView uri={post.uri} />)
                    }
                }}
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
                                // 幅が足りないときは名前より先にこちらを見切る
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
                headerRight={post.record.createdAt && <TimeDiff date={new Date(post.record.createdAt)} />}
            >
                {/* ネイティブ/APノートと同じく、本文を RenderedBody で包んで三点メニューの「翻訳」を使えるようにする。
                    リンクカードは Bluesky 側の external embed を使うので AutoSummary は挟まない */}
                <RenderedBodyProvider>
                    <MessageTranslationProvider>
                        <TranslatableBody>
                            <RenderedBody>
                                <BskyRichText text={post.record.text ?? ''} facets={post.record.facets} />
                            </RenderedBody>
                        </TranslatableBody>
                        {medias.length > 0 && <MediaGallery medias={medias} messageURI={props.message?.uri} />}
                        {external && (
                            // ネイティブのAutoSummaryと同じ埋め込み(YouTube等はiframe・他はUrlSummaryCard)。
                            // サマリーはBluesky側のembedに入っているものを使い、hyperproxyには問い合わせない
                            <UrlEmbed
                                url={external.uri}
                                summary={{
                                    title: external.title,
                                    description: external.description,
                                    thumbnail: external.thumb
                                }}
                            />
                        )}
                        {props.detail && postUrl && (
                            <ExternalLink href={postUrl} style={openRemoteStyle}>
                                <MdOpenInNew size={14} />
                                {t('openRemote')}
                            </ExternalLink>
                        )}
                        {props.message && <MessageFooter message={props.message} rerouted={props.rerouted} />}
                    </MessageTranslationProvider>
                </RenderedBodyProvider>
            </MessageLayout>
        </div>
    )
}
