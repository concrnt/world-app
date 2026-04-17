import { Fragment, Suspense, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react'
import { ScrollViewProps } from '../types/ScrollView'
import { useClient } from '../contexts/Client'
import { useRefWithUpdate } from '../hooks/useRefWithUpdate'
import { QueryTimelineReader } from '@concrnt/client'
import { Message, Schemas, ReactionAssociationSchema, LikeAssociationSchema } from '@concrnt/worldlib'
import { MessageContainer } from './message'
import { Avatar, CfmRenderer, CssVar, Divider } from '@concrnt/ui'
import { MessageSkeleton } from './message/MessageSkeleton'
import { Loading } from './message/Loading'
import { RenderError } from './message/RenderError'
import { ErrorBoundary } from 'react-error-boundary'
import { MdStar, MdEmojiEmotions } from 'react-icons/md'
import { useStack } from '../layouts/Stack'
import { PostView } from '../views/Post'
import { ProfileView } from '../views/Profile'
import { PullToRefresh } from './PullToRefresh'

// 通知を集約した表示単位
// - summarised-like: 同じ投稿に対する Like をまとめたもの
// - summarised-reaction: 同じ投稿に対する Reaction をまとめたもの（絵文字違いでもここでひとまとめ）
// - normal: Reply / Reroute / Mention など、集約しない単発通知
interface WrappedNotification {
    key: string
    type: 'summarised-like' | 'summarised-reaction' | 'normal'
    items: Message<any>[]
    // normal の元 ChunklineItem 情報（MessageContainer に渡すため）
    href?: string
    source?: string
}

interface Props extends ScrollViewProps {
    prefix: string
    query?: any
    batchSize?: number
    header?: React.ReactNode
    filterSchema?: string
}

// 集約キーのサフィックス（'$' を含むキーは集約対象として識別する）
const KEY_SUFFIX_LIKE = '$like'
const KEY_SUFFIX_REACTION = '$reaction'

// 左アイコンコラムの共通スタイル
// - 幅 48px は既存 MessageLayout のアバタースペースと揃えるため
// - paddingLeft 5px は画面端とアイコンの間の余白
const ICON_COLUMN_WIDTH = '48px'
const ICON_COLUMN_PADDING_LEFT = '5px'
const ICON_SIZE = 32

export const NotificationTimeline = (props: Props) => {
    const { client } = useClient()

    const loadingRef = useRef(true)
    const scrollPositionRef = useRef<number>(0)
    const [reader, update] = useRefWithUpdate<QueryTimelineReader | undefined>(undefined)
    const [loading, setLoading] = useState(true)
    const [hasMoreData, setHasMoreData] = useState<boolean>(false)
    const [notifications, setNotifications] = useState<WrappedNotification[]>([])
    // PullToRefresh のインジケータ表示制御用（reload 中は spinner アイコンになる）
    const [isFetching, setIsFetching] = useState(false)

    // reader.body のうちどこまで集約済みかを保持するカーソル
    // init/reload で 0 リセット、readMore で積み上げる
    const iter = useRef(0)

    const summariseNotifications = async (): Promise<WrappedNotification[]> => {
        if (!reader.current || !client) return []

        const newItems = reader.current.body.slice(iter.current, reader.current.body.length)
        iter.current = reader.current.body.length

        // ChunklineItem 自体は { href, source, timestamp } のみ（href / source は optional）。
        // Message を resolve しつつ、normal のとき MessageContainer に渡せるよう元情報を保持する。
        const resolved = await Promise.all(
            newItems.map(async (item) => {
                if (!item.href) return { item, msg: null }
                const hint = item.source ? new URL(item.source).hostname : undefined
                const msg = await client.getMessage<any>(item.href, hint).catch(() => null)
                return { item, msg }
            })
        )

        // 集約用 Map。key のサフィックスで summarised / normal を判別する
        const summarized = new Map<string, { items: Message<any>[]; href: string; source?: string }>()

        for (const { item, msg } of resolved) {
            if (!msg) continue
            if (!item.href) continue // href がないと集約キーや MessageContainer に渡せないのでスキップ

            let key: string
            switch (msg.schema) {
                case Schemas.likeAssociation:
                    key = (msg.associationTarget?.uri ?? msg.uri) + KEY_SUFFIX_LIKE
                    break
                case Schemas.reactionAssociation:
                    key = (msg.associationTarget?.uri ?? msg.uri) + KEY_SUFFIX_REACTION
                    break
                default:
                    // reply / reroute / mention / readAccessRequest など → 集約しない
                    key = item.href
            }

            const existing = summarized.get(key)
            if (existing) {
                existing.items.push(msg)
            } else {
                summarized.set(key, { items: [msg], href: item.href, source: item.source })
            }
        }

        const result: WrappedNotification[] = []
        for (const [key, value] of summarized) {
            if (value.items.length === 0) continue

            if (key.endsWith(KEY_SUFFIX_LIKE)) {
                result.push({
                    key: value.items[0].uri,
                    type: 'summarised-like',
                    items: value.items
                })
            } else if (key.endsWith(KEY_SUFFIX_REACTION)) {
                result.push({
                    key: value.items[0].uri,
                    type: 'summarised-reaction',
                    items: value.items
                })
            } else {
                result.push({
                    key,
                    type: 'normal',
                    items: value.items,
                    href: value.href,
                    source: value.source
                })
            }
        }

        return result
    }

    useEffect(() => {
        let isCancelled = false
        if (!client) return

        // 初期化: カーソルと表示をリセットしてから Reader を作る
        setNotifications([])
        iter.current = 0
        loadingRef.current = true
        setLoading(true)

        client.newQueryTimelineReader().then((t) => {
            if (isCancelled) return
            t.onUpdate = () => {
                update()
            }
            reader.current = t

            t.init(props.prefix, props.query, props.batchSize ?? 16)
                .then((hasMore) => {
                    if (isCancelled) return
                    setHasMoreData(hasMore)
                    return summariseNotifications()
                })
                .then((newNotifications) => {
                    if (isCancelled || !newNotifications) return
                    setNotifications(newNotifications)
                })
                .finally(() => {
                    if (isCancelled) return
                    loadingRef.current = false
                    setLoading(false)
                })
        })

        return () => {
            isCancelled = true
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [client, props.prefix, props.query, props.batchSize])

    const scrollRef = useRef<HTMLDivElement>(null)

    useImperativeHandle(props.ref, () => ({
        scrollToTop: () => {
            if (scrollRef.current) {
                scrollRef.current.scrollTo({ top: 0, behavior: 'smooth' })
            }
        }
    }))

    // PullToRefresh のリロード処理
    // reader.reload() で body を更新した後、iter を 0 に戻して再集約する
    const onRefresh = useCallback(async () => {
        if (!reader.current) return
        setIsFetching(true)
        try {
            // reload() は init と同等の挙動（body を巻き戻して再取得）
            // それに合わせて iter と表示側の集約済みをリセットする必要がある
            iter.current = 0
            setNotifications([])
            const hasMore = await reader.current.reload()
            setHasMoreData(hasMore)
            const newNotifications = await summariseNotifications()
            setNotifications(newNotifications)
            // ユーザーにリフレッシュのフィードバックを見せるための短い待機
            await new Promise((resolve) => setTimeout(resolve, 500))
        } finally {
            setIsFetching(false)
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [reader])

    useEffect(() => {
        const el = scrollRef.current
        if (!el) return

        const handleScroll = () => {
            // PullToRefresh用にスクロール位置を記録
            scrollPositionRef.current = el.scrollTop

            if (el.scrollHeight - el.scrollTop - el.clientHeight < 500) {
                if (loadingRef.current) return
                if (!hasMoreData) return
                if (!reader.current) return

                console.log('Reading more...')

                loadingRef.current = true
                setLoading(true)
                reader.current
                    .readMore()
                    .then((hasMore) => {
                        setHasMoreData(hasMore)
                        return summariseNotifications()
                    })
                    .then((newNotifications) => {
                        if (newNotifications && newNotifications.length > 0) {
                            setNotifications((prev) => [...prev, ...newNotifications])
                        }
                    })
                    .catch((e) => {
                        console.error('Failed to read more', e)
                    })
                    .finally(() => {
                        loadingRef.current = false
                        setLoading(false)
                        console.log('Finished reading more')
                    })
            }
        }

        el.addEventListener('scroll', handleScroll)
        return () => {
            el.removeEventListener('scroll', handleScroll)
        }
    }, [scrollRef, reader, hasMoreData])

    // filterSchema が指定されていればクライアント側で絞り込む
    // - summarised-like / summarised-reaction は type で判定
    // - normal は items[0].schema（= 元 Message の schema）と比較
    // items が空のケースはそもそも summariseNotifications で弾かれているので n.items[0] は安全
    const filteredNotifications = props.filterSchema
        ? notifications.filter((n) => {
              if (n.type === 'summarised-like') return props.filterSchema === Schemas.likeAssociation
              if (n.type === 'summarised-reaction') return props.filterSchema === Schemas.reactionAssociation
              // normal
              return n.items[0]?.schema === props.filterSchema
          })
        : notifications

    return (
        <PullToRefresh positionRef={scrollPositionRef} isFetching={isFetching} onRefresh={onRefresh}>
            <div
                style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px',
                    // ヘッダー（Notifications タイトルバー）と最初の通知の間に 5px の余白を設ける
                    paddingTop: '5px',
                    overflowX: 'hidden',
                    overflowY: 'auto',
                    // iOS の慣性スクロール跨ね返りを抑制して PullToRefresh との干渉を防ぐ
                    overscrollBehaviorY: 'none'
                }}
                ref={scrollRef}
            >
                {props.header}
                {filteredNotifications.map((n) => (
                    <Fragment key={n.key}>
                        <ErrorBoundary FallbackComponent={RenderError}>
                            <div
                                style={{
                                    padding: `0 ${CssVar.space(2)}`,
                                    contentVisibility: 'auto'
                                }}
                            >
                                {n.type === 'summarised-like' && <SummarisedLike items={n.items} />}
                                {n.type === 'summarised-reaction' && <SummarisedReaction items={n.items} />}
                                {n.type === 'normal' && n.href && (
                                    <Suspense fallback={<MessageSkeleton />}>
                                        <MessageContainer uri={n.href} source={n.source} />
                                    </Suspense>
                                )}
                            </div>
                        </ErrorBoundary>
                        <Divider />
                    </Fragment>
                ))}
                {loading && <Loading message={'Loading...'} />}
                {!hasMoreData && (
                    <div
                        style={{
                            padding: '8px',
                            fontSize: '12px',
                            color: '#888',
                            width: '100%',
                            height: '100px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                        }}
                    >
                        -- End of Timeline --
                    </div>
                )}
            </div>
        </PullToRefresh>
    )
}

// Like の集約表示
// レイアウト: 左アイコンコラム (width: ICON_COLUMN_WIDTH, paddingLeft: ICON_COLUMN_PADDING_LEFT)
//            + 右コンテンツコラム (flex: 1, アバター/文言/プレビューを縦積み)
const SummarisedLike = (props: { items: Message<LikeAssociationSchema>[] }) => {
    const { push } = useStack()

    // 集約グループ内の全 Message は同じ associationTarget を指している前提
    // （集約キーが `${associationTarget.uri}${KEY_SUFFIX_LIKE}` のため）
    const target = props.items[0].associationTarget
    const firstAuthor = props.items[0].authorUser

    return (
        <div
            style={{
                display: 'flex',
                flexDirection: 'row',
                cursor: 'pointer'
            }}
            onClick={() => {
                if (target) {
                    push(<PostView uri={target.uri} />)
                }
            }}
        >
            {/* 左カラム: 星アイコン */}
            <div
                style={{
                    width: ICON_COLUMN_WIDTH,
                    paddingLeft: ICON_COLUMN_PADDING_LEFT,
                    flexShrink: 0,
                    display: 'flex',
                    alignItems: 'flex-start',
                    // アバター行と視覚的に中央が揃うよう微調整
                    paddingTop: '2px'
                }}
            >
                <MdStar size={ICON_SIZE} style={{ opacity: 0.7 }} />
            </div>

            {/* 右カラム: アバター / 文言 / プレビュー */}
            <div
                style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px',
                    flex: 1,
                    // overflow:hidden を効かせて長いプレビューの ellipsis を機能させる
                    minWidth: 0
                }}
            >
                {/* アバター横並び */}
                <div style={{ display: 'flex', flexDirection: 'row', gap: '4px', flexWrap: 'wrap' }}>
                    {props.items.map((item) => (
                        <div
                            key={item.uri}
                            onClick={(e) => {
                                e.stopPropagation()
                                if (item.authorUser) {
                                    push(<ProfileView id={item.authorUser.ccid} />)
                                }
                            }}
                        >
                            <Avatar
                                ccid={item.author}
                                src={item.authorUser?.profile.avatar}
                                style={{ width: '32px', height: '32px' }}
                            />
                        </div>
                    ))}
                </div>

                {/* 文言 */}
                <div style={{ fontSize: '13px', opacity: 0.8 }}>
                    {props.items.length === 1 ? (
                        <span>
                            {firstAuthor?.profile.username ?? '不明'} さんがあなたの投稿をお気に入りに登録しました
                        </span>
                    ) : (
                        <span>
                            {firstAuthor?.profile.username ?? '不明'} さんと他 {props.items.length - 1}{' '}
                            人があなたの投稿をお気に入りに登録しました
                        </span>
                    )}
                </div>

                {/* 対象投稿のプレビュー */}
                {target && (
                    <div
                        style={{
                            fontSize: '12px',
                            opacity: 0.6,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap'
                        }}
                    >
                        <CfmRenderer messagebody={target.value.body ?? ''} emojiDict={target.value.emojis ?? {}} />
                    </div>
                )}

                {!target && <div style={{ opacity: 0.5, fontSize: '12px' }}>読み込み中...</div>}
            </div>
        </div>
    )
}

// Reaction の集約表示
// レイアウト: 左アイコンコラム (width: ICON_COLUMN_WIDTH, paddingLeft: ICON_COLUMN_PADDING_LEFT)
//            + 右コンテンツコラム (絵文字ごとのグループ / 文言 / プレビューを縦積み)
const SummarisedReaction = (props: { items: Message<ReactionAssociationSchema>[] }) => {
    const { push } = useStack()

    const target = props.items[0].associationTarget
    const firstAuthor = props.items[0].authorUser

    // imageUrl ごとに再グルーピング（同じ投稿に対する異なる絵文字リアクションをまとめる）
    const reactions: Record<string, Message<ReactionAssociationSchema>[]> = {}
    for (const item of props.items) {
        const url = item.value?.imageUrl ?? ''
        if (url in reactions) {
            reactions[url].push(item)
        } else {
            reactions[url] = [item]
        }
    }

    return (
        <div
            style={{
                display: 'flex',
                flexDirection: 'row',
                cursor: 'pointer'
            }}
            onClick={() => {
                if (target) {
                    push(<PostView uri={target.uri} />)
                }
            }}
        >
            {/* 左カラム: リアクションアイコン */}
            <div
                style={{
                    width: ICON_COLUMN_WIDTH,
                    paddingLeft: ICON_COLUMN_PADDING_LEFT,
                    flexShrink: 0,
                    display: 'flex',
                    alignItems: 'flex-start',
                    paddingTop: '2px'
                }}
            >
                <MdEmojiEmotions size={ICON_SIZE} style={{ opacity: 0.7 }} />
            </div>

            {/* 右カラム: 絵文字グループ / 文言 / プレビュー */}
            <div
                style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px',
                    flex: 1,
                    minWidth: 0
                }}
            >
                {/* 絵文字ごとのグループ */}
                <div
                    style={{
                        display: 'flex',
                        flexDirection: 'row',
                        gap: '8px',
                        flexWrap: 'wrap'
                    }}
                >
                    {Object.entries(reactions).map(([url, group]) => (
                        <div
                            key={url}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px',
                                padding: '2px 6px',
                                borderRadius: '4px',
                                backgroundColor: CssVar.backdropBackground
                            }}
                        >
                            {url && <img src={url} style={{ width: '20px', height: '20px' }} alt="" />}
                            {group.map((item) => (
                                <div
                                    key={item.uri}
                                    onClick={(e) => {
                                        e.stopPropagation()
                                        if (item.authorUser) {
                                            push(<ProfileView id={item.authorUser.ccid} />)
                                        }
                                    }}
                                >
                                    <Avatar
                                        ccid={item.author}
                                        src={item.authorUser?.profile.avatar}
                                        style={{ width: '20px', height: '20px' }}
                                    />
                                </div>
                            ))}
                        </div>
                    ))}
                </div>

                {/* 文言 */}
                <div style={{ fontSize: '13px', opacity: 0.8 }}>
                    {props.items.length === 1 ? (
                        <span>{firstAuthor?.profile.username ?? '不明'} さんがあなたの投稿にリアクションしました</span>
                    ) : (
                        <span>
                            {firstAuthor?.profile.username ?? '不明'} さんと他 {props.items.length - 1}{' '}
                            人があなたの投稿にリアクションしました
                        </span>
                    )}
                </div>

                {/* 対象投稿のプレビュー */}
                {target && (
                    <div
                        style={{
                            fontSize: '12px',
                            opacity: 0.6,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap'
                        }}
                    >
                        <CfmRenderer messagebody={target.value.body ?? ''} emojiDict={target.value.emojis ?? {}} />
                    </div>
                )}

                {!target && <div style={{ opacity: 0.5, fontSize: '12px' }}>読み込み中...</div>}
            </div>
        </div>
    )
}
