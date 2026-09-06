import { Button, Confirm, ListItem, Text, useAnchor } from '@concrnt/ui'
import { useTranslation } from 'react-i18next'
import { Association, LikeAssociationSchema, Schemas, type Message, type RerouteMessageSchema } from '@concrnt/worldlib'
import { useClient } from '../../contexts/Client'
import { useComposer } from '../../contexts/Composer'
import { usePostContext } from '../../contexts/PostContext'
import { useHaptics } from '../../contexts/Haptics'
import { startTransition, useOptimistic, useState } from 'react'
import { Select } from '../Select'
import { Report } from '../Report'
import { MessageInspector } from './MessageInspector'

import { MdStar } from 'react-icons/md'
import { MdStarOutline } from 'react-icons/md'
import { MdReply } from 'react-icons/md'
import { MdRepeat } from 'react-icons/md'
import { MdMoreHoriz } from 'react-icons/md'
import { MdAddReaction } from 'react-icons/md'
import { Drawer } from '../Drawer'
import { useEmojiPicker } from '../../contexts/EmojiPicker'
import { ReactionState } from './Footer'
import { useQueryTimelineContext } from '../QueryTimeline'
import { useIsMobile } from '../../hooks/useIsMobile'

interface Props {
    message: Message<any>
    rerouted?: Message<RerouteMessageSchema>
    updateReactionState: React.Dispatch<React.SetStateAction<ReactionState>>
}

interface LikeState {
    ownLike: Association<LikeAssociationSchema> | undefined
    count: number
}

export const MessageActions = (props: Props) => {
    const { t } = useTranslation('', { keyPrefix: 'components.messageActions' })
    const { client } = useClient()
    const { hapticLight, hapticSuccess } = useHaptics()
    const composer = useComposer()
    const postCtx = usePostContext()
    const [menuOpen, setMenuOpen] = useState(false)
    const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
    const [reportOpen, setReportOpen] = useState(false)
    const [inspectorOpen, setInspectorOpen] = useState(false)
    const emojiPicker = useEmojiPicker()
    const qt = useQueryTimelineContext()
    const menuAnchor = useAnchor()
    const reactionAnchor = useAnchor()
    const isMobile = useIsMobile()
    const [linkCopied, setLinkCopied] = useState(false)
    const [sourceCopied, setSourceCopied] = useState(false)

    // シェア用URLはデプロイ先ホストに関わらずconcrnt.world固定(OGP対応がconcrnt.worldのみのため)
    const shareURL = 'https://concrnt.world/post/' + encodeURIComponent(props.message.uri)

    const replyCount = props.message.associationCounts?.[Schemas.replyAssociation] ?? 0
    const rerouteCount = props.message.associationCounts?.[Schemas.rerouteAssociation] ?? 0

    const [likeState, updateLikeState] = useOptimistic<LikeState>({
        ownLike: props.message.ownAssociations.find((a) => a.schema === Schemas.likeAssociation),
        count: props.message.associationCounts?.[Schemas.likeAssociation] ?? 0
    })

    const messageHref = props.message.key ?? props.message.uri

    // commit完了後、transitionが終わる(=useOptimisticがrevertする)前に
    // メッセージ本体を再取得してベース値をサーバー状態に揃える。
    // これをsocketイベント任せにすると、イベントがcommit応答より遅れたときに
    // 一瞬いいね/リアクションが消える
    const refreshMessage = async () => {
        if (props.rerouted) {
            // リルート経由の場合: タイムライン項目のhrefはリルート文書のもの。
            // qt.update(=invalidateMessage)がリルート文書とそのtargetの両キャッシュを破棄するので、
            // 再レンダリングがuse()する両方を再取得してtransition内で解決させる
            const rerouteHref = props.rerouted.key ?? props.rerouted.uri
            qt.update(rerouteHref)
            await client?.getMessage(props.message.uri, props.message.hint).catch(() => null)
            await client?.getMessage(rerouteHref, props.rerouted.hint).catch(() => null)
        } else {
            qt.update(messageHref)
            await client?.getMessage(messageHref, props.message.hint).catch(() => null)
        }
    }

    return (
        <div
            style={{
                display: 'flex',
                flexDirection: 'row',
                gap: '8px',
                alignItems: 'center',
                flexShrink: 0
            }}
        >
            {/* リプライボタン */}
            <Button
                variant="text"
                onClick={(e) => {
                    e.stopPropagation()
                    // 元メッセージのコミュニティ投稿先を抽出（homeタイムラインは除外）
                    const communityDestinations =
                        props.message.distributes?.filter(
                            (uri) =>
                                !uri.includes('/main/home-timeline') &&
                                !uri.includes('/main/activity-timeline') &&
                                !uri.includes('/main/notify-timeline')
                        ) ?? []
                    // 候補は省略してknownCommunities全体にする(投稿先は元メッセージの配信先に限らない)
                    composer.open(communityDestinations, undefined, 'reply', props.message)
                }}
                style={{ display: 'flex', alignItems: 'center' }}
            >
                <MdReply size={20} />
                {replyCount > 0 && <span style={{ marginLeft: '4px' }}>{replyCount}</span>}
            </Button>

            {/* リルートボタン */}
            <Button
                variant="text"
                onClick={(e) => {
                    e.stopPropagation()
                    // リルート先は現在開いているビューのデフォルト投稿先。文脈のないページではホームのみ
                    composer.open(postCtx.destinations, undefined, 'reroute', props.message, postCtx.profile)
                }}
                style={{ display: 'flex', alignItems: 'center' }}
            >
                <MdRepeat size={20} />
                {rerouteCount > 0 && <span style={{ marginLeft: '4px' }}>{rerouteCount}</span>}
            </Button>

            {/* いいねボタン */}
            <Button
                variant="text"
                onClick={(e) => {
                    e.stopPropagation()
                    if (!client) return
                    hapticLight()
                    if (likeState.ownLike) {
                        startTransition(async () => {
                            updateLikeState((prev: LikeState): LikeState => {
                                return {
                                    ownLike: undefined,
                                    count: prev.count - 1
                                }
                            })
                            if (likeState.ownLike) {
                                await likeState.ownLike.delete(client)
                                await refreshMessage()
                            }
                        })
                    } else {
                        startTransition(async () => {
                            updateLikeState((prev: LikeState): LikeState => {
                                return {
                                    ownLike: new Association('dummy', {
                                        kind: 'association',
                                        schema: Schemas.likeAssociation,
                                        value: {},
                                        author: client.ccid,
                                        createdAt: new Date()
                                    }),
                                    count: prev.count + 1
                                }
                            })
                            await props.message.favorite(client)
                            await refreshMessage()
                        })
                    }
                }}
                style={{ display: 'flex', alignItems: 'center' }}
            >
                {likeState.ownLike ? <MdStar size={20} color="gold" /> : <MdStarOutline size={20} />}
                <span style={{ marginLeft: '4px' }}>{likeState.count}</span>
            </Button>
            {/* リアクションボタン */}
            <Button
                variant="text"
                onClick={(e) => {
                    e.stopPropagation()
                    if (!client) return
                    emojiPicker.open((emoji) => {
                        hapticLight()

                        startTransition(async () => {
                            props.updateReactionState((prev: ReactionState): ReactionState => {
                                const imageUrl = emoji.imageURL
                                const shortcode = emoji.shortcode
                                return {
                                    reactionCounts: {
                                        ...prev.reactionCounts,
                                        [imageUrl]: (prev.reactionCounts[imageUrl] || 0) + 1
                                    },
                                    ownReactions: {
                                        ...prev.ownReactions,
                                        [imageUrl]: new Association('dummy', {
                                            kind: 'association',
                                            author: client.ccid,
                                            schema: Schemas.reactionAssociation,
                                            value: {
                                                imageUrl,
                                                shortcode
                                            },
                                            createdAt: new Date()
                                        })
                                    }
                                }
                            })

                            await props.message.reaction(client, emoji.shortcode, emoji.imageURL).catch((err) => {
                                console.error('Failed to add reaction:', err)
                            })
                            await refreshMessage()
                        })

                        emojiPicker.close()
                    }, reactionAnchor)
                }}
                style={{ display: 'flex', alignItems: 'center', anchorName: reactionAnchor } as React.CSSProperties}
            >
                <MdAddReaction size={20} />
            </Button>
            {/* メニュー */}
            <Button
                variant="text"
                onClick={(e) => {
                    e.stopPropagation()
                    setMenuOpen(true)
                }}
                style={{ anchorName: menuAnchor } as React.CSSProperties}
            >
                <MdMoreHoriz size={20} />
            </Button>
            <Select
                open={menuOpen}
                onClose={() => setMenuOpen(false)}
                anchor={menuAnchor}
                options={[
                    // v1踏襲: モバイル幅はOSのシェアシート、それ以外はリンクのコピー
                    isMobile && typeof navigator.share === 'function' ? (
                        <ListItem
                            key="share"
                            onClick={() => {
                                navigator
                                    .share({
                                        title: props.message.value.body ?? '',
                                        text: props.message.value.body ?? '',
                                        url: shareURL
                                    })
                                    .catch(() => {})
                                setMenuOpen(false)
                            }}
                        >
                            <Text>{t('share')}</Text>
                        </ListItem>
                    ) : (
                        <ListItem
                            key="copyLink"
                            onClick={() => {
                                navigator.clipboard?.writeText(shareURL)
                                setLinkCopied(true)
                                setTimeout(() => {
                                    setLinkCopied(false)
                                    setMenuOpen(false)
                                }, 800)
                            }}
                        >
                            <Text>{linkCopied ? t('linkCopied') : t('copyLink')}</Text>
                        </ListItem>
                    ),
                    <ListItem
                        key="copySource"
                        onClick={() => {
                            if (props.message.value.body) {
                                navigator.clipboard?.writeText(props.message.value.body)
                            }
                            setSourceCopied(true)
                            setTimeout(() => {
                                setSourceCopied(false)
                                setMenuOpen(false)
                            }, 800)
                        }}
                    >
                        <Text>{sourceCopied ? t('linkCopied') : t('copySource')}</Text>
                    </ListItem>,
                    ...(props.message.author === client.ccid
                        ? [
                              <ListItem
                                  key="delete"
                                  onClick={() => {
                                      setMenuOpen(false)
                                      setDeleteConfirmOpen(true)
                                  }}
                              >
                                  <Text>{t('deletePost')}</Text>
                              </ListItem>
                          ]
                        : []),
                    <ListItem key="abuse" onClick={() => setReportOpen(true)}>
                        {t('report')}
                    </ListItem>,
                    <ListItem
                        key="inspect"
                        onClick={() => {
                            setInspectorOpen(true)
                            setMenuOpen(false)
                        }}
                    >
                        <Text>{t('inspector')}</Text>
                    </ListItem>
                ]}
            />
            <Confirm
                open={deleteConfirmOpen}
                onClose={() => setDeleteConfirmOpen(false)}
                title={t('confirmDelete')}
                confirmText={t('delete')}
                onConfirm={() => {
                    client?.api.delete(props.message.uri).then(() => hapticSuccess())
                    setMenuOpen(false)
                }}
            />
            <Drawer open={reportOpen} onClose={() => setReportOpen(false)}>
                <Report
                    targetURI={props.message.uri}
                    onSend={() => {
                        setReportOpen(false)
                        setMenuOpen(false)
                        hapticSuccess()
                    }}
                />
            </Drawer>
            <Drawer open={inspectorOpen} onClose={() => setInspectorOpen(false)}>
                <MessageInspector message={props.message} />
            </Drawer>
        </div>
    )
}
