import { MessageContainer } from '../components/message'
import { Avatar, Divider, Tabs, Tab, Text, View } from '@concrnt/ui'
import { FAB } from '../ui/FAB'
import { Header } from '../ui/Header'
import { MdReply } from 'react-icons/md'
import { Suspense, useCallback, useEffect, useMemo, useState } from 'react'
import { useClient } from '../contexts/Client'
import {
    Association,
    LikeAssociationSchema,
    ReactionAssociationSchema,
    ReplyAssociationSchema,
    RerouteAssociationSchema,
    Schemas,
    User
} from '@concrnt/worldlib'
import { CssVar } from '../types/Theme'
import { useStack } from '../layouts/Stack'
import { ProfileView } from './Profile'
import { MessageSkeleton } from '../components/message/MessageSkeleton'
import { useComposer } from '../contexts/Composer'
import { TimeDiff } from '../components/TimeDiff'

type PostTab = 'replies' | 'reroutes' | 'favorites' | 'reactions'

interface Props {
    uri: string
}

export const PostView = (props: Props) => {
    const { client } = useClient()
    const { push } = useStack()
    const composer = useComposer()
    const [tab, setTab] = useState<PostTab>('replies')

    // --- アソシエーション取得 ---
    const [replies, setReplies] = useState<Association<ReplyAssociationSchema>[]>([])
    const [reroutes, setReroutes] = useState<Association<RerouteAssociationSchema>[]>([])
    const [favorites, setFavorites] = useState<Association<LikeAssociationSchema>[]>([])
    const [reactions, setReactions] = useState<Association<ReactionAssociationSchema>[]>([])
    const [loading, setLoading] = useState(false)

    // メッセージのdistributes取得用
    const messagePromise = useMemo(() => {
        return client?.getMessage<any>(props.uri)
    }, [client, props.uri])

    const fetchAssociations = useCallback(
        async (targetTab: PostTab) => {
            if (!client) return
            setLoading(true)
            try {
                const schemaMap: Record<PostTab, string> = {
                    replies: Schemas.replyAssociation,
                    reroutes: Schemas.rerouteAssociation,
                    favorites: Schemas.likeAssociation,
                    reactions: Schemas.reactionAssociation
                }
                const sds = await client.api.getAssociations(props.uri, { schema: schemaMap[targetTab] })
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
                    case 'reactions':
                        setReactions(associations)
                        break
                }
            } catch (e) {
                console.error('Failed to fetch associations:', e)
            } finally {
                setLoading(false)
            }
        },
        [client, props.uri]
    )

    useEffect(() => {
        fetchAssociations(tab)
    }, [tab, fetchAssociations])

    const handleReply = useCallback(async () => {
        const msg = await messagePromise
        if (!msg) return
        const communityDestinations =
            msg.distributes?.filter(
                (uri: string) =>
                    !uri.includes('/main/home-timeline') &&
                    !uri.includes('/main/activity-timeline') &&
                    !uri.includes('/main/notify-timeline')
            ) ?? []
        composer.open(communityDestinations, [], 'reply', msg)
    }, [messagePromise, composer])

    return (
        <>
            <View>
                <Header>Message</Header>
                <div
                    style={{
                        padding: CssVar.space(1)
                    }}
                >
                    <Suspense fallback={<MessageSkeleton />}>
                        <MessageContainer uri={props.uri} />
                    </Suspense>
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
                            <Text>読み込み中...</Text>
                        </div>
                    )}

                    {!loading && tab === 'replies' && (
                        <>
                            {replies.length === 0 && (
                                <div style={{ padding: CssVar.space(2), textAlign: 'center', opacity: 0.5 }}>
                                    <Text>リプライはまだありません</Text>
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
                                        <MessageContainer uri={reply.value.messageId} />
                                    </Suspense>
                                </div>
                            ))}
                        </>
                    )}

                    {!loading && tab === 'reroutes' && (
                        <>
                            {reroutes.length === 0 && (
                                <div style={{ padding: CssVar.space(2), textAlign: 'center', opacity: 0.5 }}>
                                    <Text>リルートはまだありません</Text>
                                </div>
                            )}
                            {reroutes.map((reroute) => (
                                <AssociationUserItem
                                    key={reroute.ccfs}
                                    ccid={reroute.author}
                                    date={reroute.createdAt}
                                    onClick={() => push(<ProfileView id={reroute.author} />)}
                                >
                                    がリルートしました
                                </AssociationUserItem>
                            ))}
                        </>
                    )}

                    {!loading && tab === 'favorites' && (
                        <>
                            {favorites.length === 0 && (
                                <div style={{ padding: CssVar.space(2), textAlign: 'center', opacity: 0.5 }}>
                                    <Text>お気に入りはまだありません</Text>
                                </div>
                            )}
                            {favorites.map((fav) => (
                                <AssociationUserItem
                                    key={fav.ccfs}
                                    ccid={fav.author}
                                    date={fav.createdAt}
                                    onClick={() => push(<ProfileView id={fav.author} />)}
                                >
                                    がお気に入りに登録しました
                                </AssociationUserItem>
                            ))}
                        </>
                    )}

                    {!loading && tab === 'reactions' && (
                        <>
                            {reactions.length === 0 && (
                                <div style={{ padding: CssVar.space(2), textAlign: 'center', opacity: 0.5 }}>
                                    <Text>リアクションはまだありません</Text>
                                </div>
                            )}
                            {reactions.map((reaction) => (
                                <AssociationUserItem
                                    key={reaction.ccfs}
                                    ccid={reaction.author}
                                    date={reaction.createdAt}
                                    onClick={() => push(<ProfileView id={reaction.author} />)}
                                >
                                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                        がリアクション
                                        <img
                                            src={reaction.value.imageUrl}
                                            alt={reaction.value.shortcode}
                                            style={{ height: '16px', verticalAlign: 'middle' }}
                                        />
                                    </span>
                                </AssociationUserItem>
                            ))}
                        </>
                    )}
                </div>
            </View>
            <FAB onClick={handleReply}>
                <MdReply size={24} />
            </FAB>
        </>
    )
}

// --- アソシエーション著者表示コンポーネント ---

interface AssociationUserItemProps {
    ccid: string
    date: Date
    children: React.ReactNode
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
                <span style={{ opacity: 0.7 }}>{props.children}</span>
            </div>
            <TimeDiff date={props.date instanceof Date ? props.date : new Date(props.date)} />
        </div>
    )
}
