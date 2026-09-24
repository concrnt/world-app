import { MessageContainer } from '../../components/message'
import { CCImage, Avatar, Divider, Tabs, Tab, Text, Button } from '@concrnt/ui'
import { Suspense, use, useCallback, useEffect, useState } from 'react'
import { renderUriTemplate } from '@concrnt/client'
import { useTranslation } from 'react-i18next'
import { useClient } from '../../contexts/Client'
import {
    Association,
    LikeAssociationSchema,
    ReactionAssociationSchema,
    ReplyAssociationSchema,
    RerouteAssociationSchema,
    Schemas,
    User
} from '@concrnt/worldlib'
import { CssVar } from '../../types/Theme'
import { useNavigate } from 'react-router-dom'
import { MessageSkeleton } from '../../components/message/MessageSkeleton'
import { RenderError } from '../../components/message/RenderError'
import { TimeDiff } from '../../components/TimeDiff'
import { View } from '../../components/View'
import { Header } from '../../components/Header'
import { ErrorBoundary } from 'react-error-boundary'
import { MdLock } from 'react-icons/md'

type PostTab = 'replies' | 'reroutes' | 'favorites' | 'reactions'

interface Props {
    uri: string
    // ビューアのパネル等に埋め込むとき: 自前のヘッダーを出さない
    embedded?: boolean
}

// views/Post.tsx のゲスト(未ログイン)版。返信Composerとリアクション追加を持たない
export const GuestPostView = (props: Props) => {
    const { t } = useTranslation('', { keyPrefix: 'web.guestPost' })
    const { client } = useClient()
    const navigate = useNavigate()
    const [tab, setTab] = useState<PostTab>('replies')

    // --- Replies / Reroutes / Favorites ---
    const [replies, setReplies] = useState<Association<ReplyAssociationSchema>[]>([])
    const [reroutes, setReroutes] = useState<Association<RerouteAssociationSchema>[]>([])
    const [favorites, setFavorites] = useState<Association<LikeAssociationSchema>[]>([])
    const [loading, setLoading] = useState(false)

    // --- Reactions（絵文字ごと集約表示） ---
    const [reactionCounts, setReactionCounts] = useState<Record<string, number>>({})
    const [selectedReaction, setSelectedReaction] = useState<string | null>(null)
    const [reactionMembers, setReactionMembers] = useState<Association<ReactionAssociationSchema>[]>([])
    const [loadingMembers, setLoadingMembers] = useState(false)

    const fetchAssociations = useCallback(
        async (targetTab: PostTab) => {
            if (!client) return
            setLoading(true)
            try {
                if (targetTab === 'reactions') {
                    // リアクションは種別ごとのカウントを取得
                    const counts = await client.api.getAssociationCounts(props.uri, Schemas.reactionAssociation)
                    setReactionCounts(counts)
                    setSelectedReaction(null)
                    setReactionMembers([])
                } else {
                    const schemaMap: Record<string, string> = {
                        replies: Schemas.replyAssociation,
                        reroutes: Schemas.rerouteAssociation,
                        favorites: Schemas.likeAssociation
                    }
                    const sds = await client.api.getAssociationsAll(props.uri, {
                        schema: schemaMap[targetTab]
                    })
                    const associations = sds.map((sd) => Association.fromSignedDocument(sd))

                    switch (targetTab) {
                        case 'replies':
                            setReplies(associations)
                            break
                        case 'reroutes':
                            setReroutes(associations)
                            break
                        case 'favorites':
                            setFavorites(associations)
                            break
                    }
                }
            } catch (e) {
                console.error('Failed to fetch associations:', e)
            } finally {
                setLoading(false)
            }
        },
        [client, props.uri]
    )

    // 特定リアクションのメンバー一覧を取得
    const fetchReactionMembers = useCallback(
        async (imageUrl: string) => {
            if (!client) return
            setSelectedReaction(imageUrl)
            setLoadingMembers(true)
            try {
                const sds = await client.api.getAssociationsAll(props.uri, {
                    schema: Schemas.reactionAssociation,
                    variant: imageUrl
                })
                const members = sds.map((sd) =>
                    Association.fromSignedDocument(sd)
                ) as Association<ReactionAssociationSchema>[]
                setReactionMembers(members)
            } catch (e) {
                console.error('Failed to fetch reaction members:', e)
            } finally {
                setLoadingMembers(false)
            }
        },
        [client, props.uri]
    )

    useEffect(() => {
        fetchAssociations(tab)
    }, [tab, fetchAssociations])

    return (
        <>
            <View style={props.embedded ? { margin: 0 } : undefined}>
                {!props.embedded && <Header>Message</Header>}
                <div
                    style={{
                        padding: CssVar.space(1)
                    }}
                >
                    <ErrorBoundary FallbackComponent={RestrictedFallback}>
                        <Suspense fallback={<MessageSkeleton />}>
                            {!props.embedded && <PostHead uri={props.uri} />}
                            <MessageContainer uri={props.uri} forceExpanded detail />
                        </Suspense>
                    </ErrorBoundary>
                </div>
                <Divider />
                <Tabs>
                    <Tab
                        selected={tab === 'replies'}
                        onClick={() => setTab('replies')}
                        groupId="post-detail-tabs"
                        style={{ color: CssVar.contentText, flex: 1 }}
                    >
                        Replies
                    </Tab>
                    <Tab
                        selected={tab === 'reroutes'}
                        onClick={() => setTab('reroutes')}
                        groupId="post-detail-tabs"
                        style={{ color: CssVar.contentText, flex: 1 }}
                    >
                        Reroutes
                    </Tab>
                    <Tab
                        selected={tab === 'favorites'}
                        onClick={() => setTab('favorites')}
                        groupId="post-detail-tabs"
                        style={{ color: CssVar.contentText, flex: 1 }}
                    >
                        Favorites
                    </Tab>
                    <Tab
                        selected={tab === 'reactions'}
                        onClick={() => setTab('reactions')}
                        groupId="post-detail-tabs"
                        style={{ color: CssVar.contentText, flex: 1 }}
                    >
                        Reactions
                    </Tab>
                </Tabs>

                <div
                    style={{
                        padding: CssVar.space(1),
                        display: 'flex',
                        flexDirection: 'column',
                        gap: CssVar.space(1)
                    }}
                >
                    {loading && (
                        <div style={{ padding: CssVar.space(2), textAlign: 'center', opacity: 0.5 }}>
                            <Text>{t('loading')}</Text>
                        </div>
                    )}

                    {!loading && tab === 'replies' && (
                        <>
                            {replies.length === 0 && (
                                <div style={{ padding: CssVar.space(2), textAlign: 'center', opacity: 0.5 }}>
                                    <Text>{t('noReplies')}</Text>
                                </div>
                            )}
                            {replies.map((reply) => (
                                <div
                                    key={reply.ccfs}
                                    style={{
                                        backgroundColor: CssVar.contentBackground,
                                        borderRadius: CssVar.round(1),
                                        padding: CssVar.space(1)
                                    }}
                                >
                                    <ErrorBoundary FallbackComponent={RenderError}>
                                        <Suspense fallback={<MessageSkeleton />}>
                                            <MessageContainer uri={reply.value.targetURI} />
                                        </Suspense>
                                    </ErrorBoundary>
                                </div>
                            ))}
                        </>
                    )}

                    {!loading && tab === 'reroutes' && (
                        <>
                            {reroutes.length === 0 && (
                                <div style={{ padding: CssVar.space(2), textAlign: 'center', opacity: 0.5 }}>
                                    <Text>{t('noReroutes')}</Text>
                                </div>
                            )}
                            {reroutes.map((reroute) => (
                                <AssociationUserItem
                                    key={reroute.ccfs}
                                    ccid={reroute.author}
                                    date={reroute.createdAt}
                                    onClick={() => navigate('/profile/' + reroute.author)}
                                >
                                    {t('rerouted')}
                                </AssociationUserItem>
                            ))}
                        </>
                    )}

                    {!loading && tab === 'favorites' && (
                        <>
                            {favorites.length === 0 && (
                                <div style={{ padding: CssVar.space(2), textAlign: 'center', opacity: 0.5 }}>
                                    <Text>{t('noFavorites')}</Text>
                                </div>
                            )}
                            {favorites.map((fav) => (
                                <AssociationUserItem
                                    key={fav.ccfs}
                                    ccid={fav.author}
                                    date={fav.createdAt}
                                    onClick={() => navigate('/profile/' + fav.author)}
                                >
                                    {t('favorited')}
                                </AssociationUserItem>
                            ))}
                        </>
                    )}

                    {!loading && tab === 'reactions' && (
                        <>
                            {Object.keys(reactionCounts).length === 0 && (
                                <div style={{ padding: CssVar.space(2), textAlign: 'center', opacity: 0.5 }}>
                                    <Text>{t('noReactions')}</Text>
                                </div>
                            )}

                            {/* リアクション絵文字チップ一覧 */}
                            {Object.keys(reactionCounts).length > 0 && (
                                <div
                                    style={{
                                        display: 'flex',
                                        flexWrap: 'wrap',
                                        gap: '8px'
                                    }}
                                >
                                    {Object.entries(reactionCounts).map(([imageUrl, count]) => (
                                        <button
                                            key={imageUrl}
                                            onClick={() => fetchReactionMembers(imageUrl)}
                                            style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '4px',
                                                padding: '4px 10px',
                                                borderRadius: '16px',
                                                border:
                                                    selectedReaction === imageUrl
                                                        ? `2px solid ${CssVar.contentLink}`
                                                        : `1px solid ${CssVar.divider}`,
                                                backgroundColor:
                                                    selectedReaction === imageUrl
                                                        ? CssVar.backdropBackground
                                                        : 'transparent',
                                                cursor: 'pointer',
                                                color: CssVar.contentText,
                                                fontSize: '14px'
                                            }}
                                        >
                                            <CCImage src={imageUrl} maxHeight={128} alt="" style={{ height: '20px' }} />
                                            <span>{count}</span>
                                        </button>
                                    ))}
                                </div>
                            )}

                            {/* 選択中リアクションのメンバー一覧 */}
                            {selectedReaction && (
                                <>
                                    <Divider />
                                    {loadingMembers && (
                                        <div
                                            style={{
                                                padding: CssVar.space(2),
                                                textAlign: 'center',
                                                opacity: 0.5
                                            }}
                                        >
                                            <Text>{t('loading')}</Text>
                                        </div>
                                    )}
                                    {!loadingMembers &&
                                        reactionMembers.map((member) => (
                                            <AssociationUserItem
                                                key={member.ccfs}
                                                ccid={member.author}
                                                date={member.createdAt}
                                                onClick={() => navigate('/profile/' + member.author)}
                                            />
                                        ))}
                                </>
                            )}
                        </>
                    )}
                </div>
            </View>
        </>
    )
}

// クローラー向けのhead要素(title/description/canonical)とJSON-LD。
// MessageContainerと同じ client.getMessage(uri) を使う(worldlibがキャッシュするので追加フェッチは無い)
const jsonLdSchemas: string[] = [
    Schemas.markdownMessage,
    Schemas.gfmMessage,
    Schemas.mfmMessage,
    Schemas.plaintextMessage,
    Schemas.mediaMessage,
    Schemas.replyMessage
]

const PostHead = (props: { uri: string }) => {
    const { client } = useClient()
    const message = use(client.getMessage<any>(props.uri))
    if (!message) return <meta name="robots" content="noindex" />

    const origin = window.location.origin
    const url = origin + '/post/' + encodeURIComponent(props.uri)
    const username: string = message.authorProfile?.username || 'Anonymous'
    const authorURL =
        origin +
        '/profile/' +
        message.author +
        (message.authorProfileName && message.authorProfileName !== 'main' ? '/' + message.authorProfileName : '')

    // ccfs://はクローラーが取得できないのでresolveエンドポイント(303でファイルへ)に変換する
    const resolveURL = (src?: string): string | undefined => {
        if (!src) return undefined
        if (!src.startsWith('ccfs://')) return src
        if (client.server && 'net.concrnt.core.resolve' in client.server.endpoints) {
            return `https://${client.api.defaultHost}${renderUriTemplate(client.server, 'net.concrnt.core.resolve', { uri: src })}`
        }
        return `https://${client.api.defaultHost}/api/v2/resolve?uri=${encodeURIComponent(src)}`
    }

    const rawBody: string = typeof message.value?.body === 'string' ? message.value.body : ''
    const imageRegex = /!\[[^\]]*\]\(([^)]*)\)/g
    const images = Array.from(rawBody.matchAll(imageRegex), (m) => resolveURL(m[1])).filter(
        (s): s is string => s !== undefined
    )
    const videos: string[] = []
    for (const media of Array.isArray(message.value?.medias) ? message.value.medias : []) {
        if (media.flag) continue
        const src = resolveURL(media.mediaURL)
        if (!src) continue
        if (media.mediaType?.startsWith('image')) images.push(src)
        else if (media.mediaType?.startsWith('video')) videos.push(src)
    }
    let description = rawBody.replace(imageRegex, '').trim()
    if (description.length > 300) description = description.slice(0, 300) + '…'

    const datePublished = new Date(message.createdAt).toISOString()
    const counts: Record<string, number> = message.associationCounts ?? {}
    // JSON.stringifyがundefinedのプロパティを落とすので、無い項目はundefinedのままでよい
    const jsonLd = jsonLdSchemas.includes(message.schema)
        ? {
              '@context': 'https://schema.org',
              '@type': 'SocialMediaPosting',
              identifier: props.uri,
              url,
              datePublished,
              text: rawBody || undefined,
              image: images.length > 0 ? images : undefined,
              video:
                  videos.length > 0
                      ? videos.map((v) => ({ '@type': 'VideoObject', contentUrl: v, uploadDate: datePublished }))
                      : undefined,
              author: {
                  '@type': 'Person',
                  identifier: message.author,
                  name: username,
                  alternateName: message.authorUser?.alias,
                  url: authorURL,
                  image: resolveURL(message.authorProfile?.avatar)
              },
              interactionStatistic: [
                  {
                      '@type': 'InteractionCounter',
                      interactionType: 'https://schema.org/LikeAction',
                      userInteractionCount: counts[Schemas.likeAssociation] ?? 0
                  },
                  {
                      '@type': 'InteractionCounter',
                      interactionType: 'https://schema.org/CommentAction',
                      userInteractionCount: counts[Schemas.replyAssociation] ?? 0
                  },
                  {
                      '@type': 'InteractionCounter',
                      interactionType: 'https://schema.org/ShareAction',
                      userInteractionCount: counts[Schemas.rerouteAssociation] ?? 0
                  }
              ]
          }
        : undefined

    return (
        <>
            <title>{`${username} on Concrnt`}</title>
            {description !== '' && <meta name="description" content={description} />}
            <link rel="canonical" href={url} />
            {jsonLd && <script type="application/ld+json">{JSON.stringify(jsonLd)}</script>}
        </>
    )
}

// 制限付き・取得失敗時のフォールバック(ゲストは閲覧リクエストを送れないためログインを促す)
const RestrictedFallback = () => {
    const { t } = useTranslation('', { keyPrefix: 'web.guestPost' })
    const navigate = useNavigate()
    return (
        <div
            style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: CssVar.space(2),
                padding: CssVar.space(4)
            }}
        >
            <meta name="robots" content="noindex" />
            <MdLock size={48} style={{ opacity: 0.5 }} />
            <Text>{t('restrictedTitle')}</Text>
            <Text variant="caption">{t('restrictedDescription')}</Text>
            <Button onClick={() => navigate('/login')}>{t('login')}</Button>
        </div>
    )
}

// --- アソシエーション著者表示コンポーネント ---

interface AssociationUserItemProps {
    ccid: string
    date: Date
    children?: React.ReactNode
    onClick?: () => void
}

const AssociationUserItem = (props: AssociationUserItemProps) => {
    const { client } = useClient()
    const [user, setUser] = useState<User | null>(null)

    useEffect(() => {
        client?.getUser(props.ccid).then((u) => setUser(u))
    }, [props.ccid, client])

    return (
        <div
            style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: `${CssVar.space(1)} 0`,
                cursor: 'pointer'
            }}
            onClick={props.onClick}
        >
            <Avatar ccid={props.ccid} src={user?.profile.avatar} style={{ width: '32px', height: '32px' }} />
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '4px', flexWrap: 'wrap' }}>
                <span style={{ fontWeight: 'bold' }}>{user?.profile.username || 'Anonymous'}</span>
                {props.children && <span style={{ opacity: 0.7 }}>{props.children}</span>}
            </div>
            <TimeDiff date={props.date instanceof Date ? props.date : new Date(props.date)} />
        </div>
    )
}
