import { MessageContainer } from '../../components/message'
import { Avatar, Divider, Tabs, Tab, Text, Button } from '@concrnt/ui'
import { Suspense, useCallback, useEffect, useState } from 'react'
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
import { TimeDiff } from '../../components/TimeDiff'
import { View } from '../../components/View'
import { Header } from '../../components/Header'
import { ErrorBoundary } from 'react-error-boundary'
import { MdLock } from 'react-icons/md'

type PostTab = 'replies' | 'reroutes' | 'favorites' | 'reactions'

interface Props {
    uri: string
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
                    const sds = await client.api.getAssociations(props.uri, {
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
                const sds = await client.api.getAssociations(props.uri, {
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
            <View>
                <Header>Message</Header>
                <div
                    style={{
                        padding: CssVar.space(1)
                    }}
                >
                    <ErrorBoundary FallbackComponent={RestrictedFallback}>
                        <Suspense fallback={<MessageSkeleton />}>
                            <MessageContainer uri={props.uri} />
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
                <Divider />

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
                                        backgroundColor: CssVar.backdropBackground,
                                        borderRadius: CssVar.round(1),
                                        padding: CssVar.space(1)
                                    }}
                                >
                                    <Suspense fallback={<MessageSkeleton />}>
                                        <MessageContainer uri={reply.value.targetURI} />
                                    </Suspense>
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
                                            <img
                                                src={imageUrl}
                                                alt=""
                                                style={{ height: '20px', width: '20px', objectFit: 'contain' }}
                                            />
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
