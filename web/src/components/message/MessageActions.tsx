import { Button, Confirm, ListItem, Text, useAnchor } from '@concrnt/ui'
import { useTranslation } from 'react-i18next'
import { Association, LikeAssociationSchema, Schemas, type Message } from '@concrnt/worldlib'
import { useClient } from '../../contexts/Client'
import { useComposer } from '../../contexts/Composer'
import { hapticLight, hapticSuccess } from '../../utils/haptics'
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

interface Props {
    message: Message<any>
    updateReactionState: React.Dispatch<React.SetStateAction<ReactionState>>
}

interface LikeState {
    ownLike: Association<LikeAssociationSchema> | undefined
    count: number
}

export const MessageActions = (props: Props) => {
    const { t } = useTranslation('', { keyPrefix: 'components.messageActions' })
    const { client } = useClient()
    const composer = useComposer()
    const [menuOpen, setMenuOpen] = useState(false)
    const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
    const [reportOpen, setReportOpen] = useState(false)
    const [inspectorOpen, setInspectorOpen] = useState(false)
    const emojiPicker = useEmojiPicker()
    const qt = useQueryTimelineContext()
    const menuAnchor = useAnchor()

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
        qt.update(messageHref)
        await client?.getMessage(messageHref).catch(() => null)
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
                    const communityDestinations =
                        props.message.distributes?.filter(
                            (uri) =>
                                !uri.includes('/main/home-timeline') &&
                                !uri.includes('/main/activity-timeline') &&
                                !uri.includes('/main/notify-timeline')
                        ) ?? []
                    // 候補は省略してknownCommunities全体にする(リルート先は元メッセージの配信先に限らない)
                    composer.open(communityDestinations, undefined, 'reroute', props.message)
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
                    })
                }}
                style={{ display: 'flex', alignItems: 'center' }}
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
                    <ListItem key="delete" onClick={() => setDeleteConfirmOpen(true)}>
                        <Text>{t('deletePost')}</Text>
                    </ListItem>,
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
