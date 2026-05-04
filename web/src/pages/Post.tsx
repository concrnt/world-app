import { Suspense, useEffect, useState } from 'react'
import { CssVar, Divider, Tab, Tabs, Text, View } from '@concrnt/ui'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Association, Schemas, type LikeAssociationSchema, type ReactionAssociationSchema, type ReplyAssociationSchema, type RerouteAssociationSchema } from '@concrnt/worldlib'
import { MessageContainer } from '../components/message'
import { useClient } from '../contexts/Client'
import { Header } from '../ui/Header'

type PostTab = 'replies' | 'reroutes' | 'favorites' | 'reactions'

export const Post = () => {
    const { uri } = useParams()
    const decodedUri = decodeURIComponent(uri ?? '')

    return (
        <View
            style={{
                margin: 0,
                height: '100%',
                minHeight: 0
            }}
        >
            <Header
                left={
                    <Link to="/" style={{ color: 'inherit', textDecoration: 'none' }}>
                        Back
                    </Link>
                }
            >
                Post
            </Header>
            {decodedUri ? <PostBody uri={decodedUri} /> : <PostStatus label="投稿が見つかりませんでした。" />}
        </View>
    )
}

const PostBody = (props: { uri: string }) => {
    const [tab, setTab] = useState<PostTab>('replies')

    return (
        <>
            <div
                style={{
                    padding: CssVar.space(3)
                }}
            >
                <Suspense fallback={<PostStatus label="Loading post..." />}>
                    <MessageContainer uri={props.uri} />
                </Suspense>
            </div>
            <Divider />
            <Tabs
                style={{
                    paddingInline: CssVar.space(2)
                }}
            >
                <Tab selected={tab === 'replies'} onClick={() => setTab('replies')} groupId="post-tabs" style={{ color: CssVar.contentText }}>
                    Replies
                </Tab>
                <Tab selected={tab === 'reroutes'} onClick={() => setTab('reroutes')} groupId="post-tabs" style={{ color: CssVar.contentText }}>
                    Reroutes
                </Tab>
                <Tab selected={tab === 'favorites'} onClick={() => setTab('favorites')} groupId="post-tabs" style={{ color: CssVar.contentText }}>
                    Favorites
                </Tab>
                <Tab selected={tab === 'reactions'} onClick={() => setTab('reactions')} groupId="post-tabs" style={{ color: CssVar.contentText }}>
                    Reactions
                </Tab>
            </Tabs>
            <Divider />
            <div
                style={{
                    flex: 1,
                    minHeight: 0,
                    overflowY: 'auto',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: CssVar.space(2),
                    padding: CssVar.space(3)
                }}
            >
                <PostTabContent key={`${props.uri}:${tab}`} uri={props.uri} tab={tab} />
            </div>
        </>
    )
}

const PostTabContent = (props: { uri: string; tab: PostTab }) => {
    const { client } = useClient()
    const navigate = useNavigate()
    const [loading, setLoading] = useState(true)
    const [replies, setReplies] = useState<Association<ReplyAssociationSchema>[]>([])
    const [reroutes, setReroutes] = useState<Association<RerouteAssociationSchema>[]>([])
    const [favorites, setFavorites] = useState<Association<LikeAssociationSchema>[]>([])
    const [reactionCounts, setReactionCounts] = useState<Record<string, number>>({})
    const [reactionMembers, setReactionMembers] = useState<Association<ReactionAssociationSchema>[]>([])
    const [selectedReaction, setSelectedReaction] = useState<string | null>(null)

    useEffect(() => {
        if (!client) return
        let isCancelled = false

        const run = async () => {
            if (props.tab === 'reactions') {
                const counts = await client.api.getAssociationCounts(props.uri, Schemas.reactionAssociation)
                if (isCancelled) return
                setReactionCounts(counts)
                return
            }

            const schema =
                props.tab === 'replies'
                    ? Schemas.replyAssociation
                    : props.tab === 'reroutes'
                      ? Schemas.rerouteAssociation
                      : Schemas.likeAssociation

            const records = await client.api.getAssociations(props.uri, { schema })
            if (isCancelled) return
            const associations = records.map((record) => Association.fromSignedDocument(record))

            if (props.tab === 'replies') {
                setReplies(associations as Association<ReplyAssociationSchema>[])
            } else if (props.tab === 'reroutes') {
                setReroutes(associations as Association<RerouteAssociationSchema>[])
            } else {
                setFavorites(associations as Association<LikeAssociationSchema>[])
            }
        }

        void run().finally(() => {
            if (!isCancelled) {
                setLoading(false)
            }
        })

        return () => {
            isCancelled = true
        }
    }, [client, props.tab, props.uri])

    if (loading) {
        return <PostStatus label="読み込み中..." compact={true} />
    }

    if (props.tab === 'replies') {
        if (replies.length === 0) {
            return <PostStatus label="リプライはまだありません。" compact={true} />
        }

        return (
            <>
                {replies.map((reply) => (
                    <Suspense key={reply.ccfs} fallback={<PostStatus label="Loading reply..." compact={true} />}>
                        <MessageContainer uri={reply.value.messageId} />
                    </Suspense>
                ))}
            </>
        )
    }

    if (props.tab === 'reroutes') {
        if (reroutes.length === 0) {
            return <PostStatus label="リルートはまだありません。" compact={true} />
        }

        return (
            <>
                {reroutes.map((reroute) => (
                    <AssociationUserItem
                        key={reroute.ccfs}
                        ccid={reroute.author}
                        label="がリルートしました"
                        onClick={() => navigate(`/profile/${encodeURIComponent(reroute.author)}`)}
                    />
                ))}
            </>
        )
    }

    if (props.tab === 'favorites') {
        if (favorites.length === 0) {
            return <PostStatus label="お気に入りはまだありません。" compact={true} />
        }

        return (
            <>
                {favorites.map((favorite) => (
                    <AssociationUserItem
                        key={favorite.ccfs}
                        ccid={favorite.author}
                        label="がお気に入りに登録しました"
                        onClick={() => navigate(`/profile/${encodeURIComponent(favorite.author)}`)}
                    />
                ))}
            </>
        )
    }

    return (
        <>
            {Object.keys(reactionCounts).length === 0 && <PostStatus label="リアクションはまだありません。" compact={true} />}
            {Object.keys(reactionCounts).length > 0 && (
                <div
                    style={{
                        display: 'flex',
                        flexWrap: 'wrap',
                        gap: CssVar.space(2)
                    }}
                >
                    {Object.entries(reactionCounts).map(([imageUrl, count]) => (
                        <button
                            key={imageUrl}
                            type="button"
                            onClick={() => {
                                if (!client) return
                                setSelectedReaction(imageUrl)
                                void client.api
                                    .getAssociations(props.uri, {
                                        schema: Schemas.reactionAssociation,
                                        variant: imageUrl
                                    })
                                    .then((records) => {
                                        setReactionMembers(
                                            records.map((record) => Association.fromSignedDocument(record)) as Association<ReactionAssociationSchema>[]
                                        )
                                    })
                            }}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: CssVar.space(1),
                                padding: `${CssVar.space(1)} ${CssVar.space(2)}`,
                                borderRadius: CssVar.round(1),
                                border: `1px solid ${selectedReaction === imageUrl ? CssVar.contentLink : CssVar.divider}`,
                                backgroundColor: 'transparent',
                                cursor: 'pointer'
                            }}
                        >
                            <img src={imageUrl} alt="" style={{ width: 20, height: 20, objectFit: 'contain' }} />
                            <span>{count}</span>
                        </button>
                    ))}
                </div>
            )}
            {selectedReaction &&
                reactionMembers.map((member) => (
                    <AssociationUserItem
                        key={member.ccfs}
                        ccid={member.author}
                        onClick={() => navigate(`/profile/${encodeURIComponent(member.author)}`)}
                    />
                ))}
        </>
    )
}

const AssociationUserItem = (props: { ccid: string; label?: string; onClick: () => void }) => {
    return (
        <button
            type="button"
            onClick={props.onClick}
            style={{
                display: 'flex',
                alignItems: 'center',
                gap: CssVar.space(2),
                border: `1px solid ${CssVar.divider}`,
                borderRadius: CssVar.round(1),
                padding: CssVar.space(3),
                backgroundColor: 'transparent',
                textAlign: 'left',
                cursor: 'pointer'
            }}
        >
            <Text>{props.ccid}</Text>
            {props.label && <Text variant="caption">{props.label}</Text>}
        </button>
    )
}

const PostStatus = (props: { label: string; compact?: boolean }) => {
    return (
        <div
            style={{
                minHeight: props.compact ? undefined : '160px',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                textAlign: 'center',
                padding: CssVar.space(4)
            }}
        >
            <Text>{props.label}</Text>
        </div>
    )
}
