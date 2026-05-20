import { MessageContainer } from '../components/message'
import { Avatar, Button, Divider, IconButton, Tabs, Tab, Text, View } from '@concrnt/ui'
import { FAB } from '../ui/FAB'
import { Header } from '../ui/Header'
import {
    MdReply,
    MdAddReaction,
    MdSend,
    MdImage,
    MdEmojiEmotions,
    MdVisibilityOff,
    MdDeleteOutline
} from 'react-icons/md'
import { Suspense, startTransition, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useClient } from '../contexts/Client'
import { CDID } from '@concrnt/client'
import {
    Association,
    LikeAssociationSchema,
    Message,
    ReactionAssociationSchema,
    ReplyAssociationSchema,
    RerouteAssociationSchema,
    Schemas,
    semantics,
    User
} from '@concrnt/worldlib'
import { useEmojiPicker, Emoji } from '../contexts/EmojiPicker'
import { hapticLight, hapticSuccess } from '../utils/haptics'
import { uploadImage } from '../utils/uploadImage'
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
    const emojiPicker = useEmojiPicker()
    const [tab, setTab] = useState<PostTab>('replies')
    const [message, setMessage] = useState<Message<any> | null>(null)

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

    // メッセージのdistributes取得用
    const messagePromise = useMemo(() => {
        return client?.getMessage<any>(props.uri)
    }, [client, props.uri])

    useEffect(() => {
        messagePromise?.then((msg) => setMessage(msg ?? null))
    }, [messagePromise])

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
                            {message && (
                                <InlineReplyEditor message={message} onSent={() => fetchAssociations('replies')} />
                            )}
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
                                    onClick={() => push(<ProfileView ccid={reroute.author} />)}
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
                                    onClick={() => push(<ProfileView ccid={fav.author} />)}
                                >
                                    がお気に入りに登録しました
                                </AssociationUserItem>
                            ))}
                        </>
                    )}

                    {!loading && tab === 'reactions' && (
                        <>
                            {/* リアクション追加ボタン */}
                            <div
                                onClick={() => {
                                    if (!client || !message) return
                                    emojiPicker.open((emoji) => {
                                        hapticLight()
                                        startTransition(async () => {
                                            await message
                                                .reaction(client, emoji.shortcode, emoji.imageURL)
                                                .catch((err) => console.error('Failed to add reaction:', err))
                                            fetchAssociations('reactions')
                                        })
                                        emojiPicker.close()
                                    })
                                }}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: CssVar.space(2),
                                    padding: CssVar.space(2),
                                    border: `1px solid ${CssVar.divider}`,
                                    borderRadius: CssVar.round(2),
                                    cursor: 'pointer',
                                    color: CssVar.contentText,
                                    opacity: 0.6
                                }}
                            >
                                <MdAddReaction size={18} />
                                <span style={{ fontSize: '0.95rem' }}>リアクションを追加...</span>
                            </div>
                            {Object.keys(reactionCounts).length === 0 && (
                                <div style={{ padding: CssVar.space(2), textAlign: 'center', opacity: 0.5 }}>
                                    <Text>リアクションはまだありません</Text>
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
                                            <Text>読み込み中...</Text>
                                        </div>
                                    )}
                                    {!loadingMembers &&
                                        reactionMembers.map((member) => (
                                            <AssociationUserItem
                                                key={member.ccfs}
                                                ccid={member.author}
                                                date={member.createdAt}
                                                onClick={() => push(<ProfileView ccid={member.author} />)}
                                            />
                                        ))}
                                </>
                            )}
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

// --- インラインリプライエディタ ---

interface InlineReplyEditorProps {
    message: Message<any>
    onSent: () => void
}

const InlineReplyEditor = ({ message, onSent }: InlineReplyEditorProps) => {
    const { client } = useClient()
    const emojiPicker = useEmojiPicker()
    const [draft, setDraft] = useState('')
    const [emojiDict, setEmojiDict] = useState<Record<string, { imageURL: string }>>({})
    const [submitting, setSubmitting] = useState(false)
    const textareaRef = useRef<HTMLTextAreaElement>(null)
    const fileInputRef = useRef<HTMLInputElement>(null)

    const handleSubmit = async () => {
        if (!client || !draft.trim()) return
        setSubmitting(true)
        try {
            const timestamp = new Date()
            const hash = CDID.newFromString(draft, timestamp).toString()
            const newPostUri = semantics.post(client.ccid, client.currentProfile, hash)
            const homeTimeline = semantics.homeTimeline(client.ccid, client.currentProfile)
            const activityTimeline = semantics.activityTimeline(client.ccid, client.currentProfile)
            const communityDestinations =
                message.distributes?.filter(
                    (uri: string) =>
                        !uri.includes('/main/home-timeline') &&
                        !uri.includes('/main/activity-timeline') &&
                        !uri.includes('/main/notify-timeline')
                ) ?? []

            await client.api.commit({
                key: newPostUri,
                schema: Schemas.replyMessage,
                value: { body: draft, replyToMessageId: message.uri, emojis: emojiDict },
                author: client.ccid,
                distributes: [homeTimeline, ...communityDestinations],
                createdAt: timestamp
            })

            const targetAuthorDomain = await client.getUser(message.author).then((u) => u?.domain)
            const notifyTimeline = semantics.notificationTimeline(message.author, 'main')

            await client.api.commit(
                {
                    author: client.ccid,
                    schema: Schemas.replyAssociation,
                    associate: message.uri,
                    value: { messageId: newPostUri },
                    distributes: [activityTimeline, notifyTimeline],
                    createdAt: timestamp
                },
                targetAuthorDomain
            )

            hapticSuccess()
            setDraft('')
            setEmojiDict({})
            onSent()
        } catch (e) {
            console.error('Reply failed:', e)
        } finally {
            setSubmitting(false)
        }
    }

    return (
        <div
            style={{
                border: `1px solid ${CssVar.divider}`,
                borderRadius: CssVar.round(2),
                padding: CssVar.space(2),
                display: 'flex',
                flexDirection: 'column',
                gap: CssVar.space(1)
            }}
        >
            <textarea
                ref={textareaRef}
                value={draft}
                placeholder="返信を入力..."
                onChange={(e) => setDraft(e.target.value)}
                style={{
                    width: '100%',
                    minHeight: '80px',
                    fontSize: '1rem',
                    boxSizing: 'border-box',
                    border: 'none',
                    outline: 'none',
                    resize: 'none',
                    background: 'transparent',
                    color: CssVar.contentText
                }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', gap: '4px' }}>
                    <IconButton onClick={() => fileInputRef.current?.click()}>
                        <MdImage size={22} />
                    </IconButton>
                    <IconButton
                        onClick={() => {
                            emojiPicker.open((emoji: Emoji) => {
                                const ta = textareaRef.current
                                if (ta) {
                                    const start = ta.selectionStart
                                    const end = ta.selectionEnd
                                    const insert = `:${emoji.shortcode}:`
                                    setDraft((prev) => prev.slice(0, start) + insert + prev.slice(end))
                                } else {
                                    setDraft((prev) => prev + `:${emoji.shortcode}:`)
                                }
                                setEmojiDict((prev) => ({ ...prev, [emoji.shortcode]: { imageURL: emoji.imageURL } }))
                            })
                        }}
                    >
                        <MdEmojiEmotions size={22} />
                    </IconButton>
                    <IconButton
                        onClick={() => {
                            const insert = '<details><summary>タップして表示</summary>\n\n</details>'
                            const ta = textareaRef.current
                            if (ta) {
                                const start = ta.selectionStart
                                const end = ta.selectionEnd
                                const newDraft = draft.slice(0, start) + insert + draft.slice(end)
                                setDraft(newDraft)
                                requestAnimationFrame(() => {
                                    const cursorPos = start + insert.indexOf('\n\n') + 1
                                    ta.setSelectionRange(cursorPos, cursorPos)
                                    ta.focus()
                                })
                            } else {
                                setDraft((prev) => prev + insert)
                            }
                        }}
                    >
                        <MdVisibilityOff size={22} />
                    </IconButton>
                    <IconButton
                        disabled={draft.length === 0}
                        onClick={() => {
                            setDraft('')
                            setEmojiDict({})
                        }}
                    >
                        <MdDeleteOutline size={22} />
                    </IconButton>
                </div>
                <Button onClick={handleSubmit} disabled={submitting || !draft.trim()} endIcon={<MdSend />}>
                    {submitting ? '送信中...' : 'リプライ'}
                </Button>
            </div>
            <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                hidden
                onChange={async (e) => {
                    if (!client || !e.target.files) return
                    const files = Array.from(e.target.files)
                    for (const file of files) {
                        const [url] = await uploadImage(client, file)
                        setDraft((prev) => prev + `\n![](${url})`)
                    }
                    e.target.value = ''
                }}
            />
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
