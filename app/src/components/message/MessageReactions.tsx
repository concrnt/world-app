import { Association, Message, ReactionAssociationSchema, RerouteMessageSchema, Schemas } from '@concrnt/worldlib'
import { Document } from '@concrnt/client'
import { useClient } from '../../contexts/Client'
import { CssVar } from '../../types/Theme'
import { hapticLight } from '../../utils/haptics'
import { startTransition } from 'react'
import { ReactionState } from './Footer'
import { ButtonBase, CCImage } from '@concrnt/ui'
import { useStack } from '../../layouts/Stack'
import { PostView } from '../../views/Post'
import { useQueryTimelineContext } from '../QueryTimeline'

// web版との意図的な差分: appはButtonBase+長押しでリアクション一覧へ遷移、
// webは素のbutton+hoverでリアクションした人をtooltip表示する(tooltipはweb限定機能)

interface Props {
    message: Message<any>
    rerouted?: Message<RerouteMessageSchema>
    reactionState: ReactionState
    updateReactionState: React.Dispatch<React.SetStateAction<ReactionState>>
}

export const MessageReactions = (props: Props) => {
    const { client } = useClient()
    const { push } = useStack()
    const qt = useQueryTimelineContext()
    const messageHref = props.message.key ?? props.message.uri

    const { reactionCounts, ownReactions } = props.reactionState

    // commit完了後、transitionが終わる(=useOptimisticがrevertする)前に
    // メッセージ本体を再取得してベース値をサーバー状態に揃える。
    // これをsocketイベント任せにすると、イベントがcommit応答より遅れたときに
    // 一瞬リアクションが消える
    const refreshMessage = async () => {
        if (props.rerouted) {
            // リルート経由の場合: タイムライン項目のhrefはリルート文書のもの。
            // qt.update(=invalidateMessage)がリルート文書とそのtargetの両キャッシュを破棄するので、
            // 再レンダリングがuse()する両方を再取得してtransition内で解決させる
            const rerouteHref = props.rerouted.key ?? props.rerouted.uri
            qt.update(rerouteHref)
            await client?.getMessage(props.message.uri).catch(() => null)
            await client?.getMessage(rerouteHref).catch(() => null)
        } else {
            qt.update(messageHref)
            await client?.getMessage(messageHref).catch(() => null)
        }
    }

    const handleReactionClick = async (imageUrl: string) => {
        if (!client) return
        hapticLight()

        if (ownReactions[imageUrl]) {
            startTransition(async () => {
                props.updateReactionState((prev: ReactionState) => {
                    const newOwnReactions = { ...prev.ownReactions }
                    delete newOwnReactions[imageUrl]
                    return {
                        reactionCounts: {
                            ...prev.reactionCounts,
                            [imageUrl]: Math.max((prev.reactionCounts[imageUrl] || 1) - 1, 0)
                        },
                        ownReactions: newOwnReactions
                    }
                })
                await ownReactions[imageUrl].delete(client).catch((e) => {
                    console.error('Failed to delete reaction:', e)
                })
                await refreshMessage()
            })
        } else {
            startTransition(async () => {
                props.updateReactionState((prev: ReactionState) => {
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
                                    shortcode: ''
                                },
                                createdAt: new Date()
                            })
                        }
                    }
                })

                const sds = await client.api
                    .getAssociations(props.message.uri, {
                        schema: Schemas.reactionAssociation,
                        variant: imageUrl,
                        limit: 1
                    })
                    .then((res) => res.items)
                    .catch((e) => {
                        console.error('Failed to fetch existing reactions:', e)
                        return []
                    })

                if (sds.length == 0) return
                const doc = JSON.parse(sds[0].document) as Document<ReactionAssociationSchema>
                const shortcode = doc.value.shortcode

                await props.message.reaction(client, shortcode, imageUrl).catch((e) => {
                    console.error('Failed to add reaction:', e)
                })
                await refreshMessage()
            })
        }
    }

    return (
        <div
            style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: '8px'
            }}
        >
            {Object.entries(reactionCounts).map(([imageUrl, count]) => {
                const isOwn = !!ownReactions[imageUrl]
                return (
                    <ButtonBase
                        key={imageUrl}
                        onClick={(e) => {
                            e.stopPropagation()
                            handleReactionClick(imageUrl)
                        }}
                        onLongPress={() => {
                            hapticLight()
                            push(<PostView uri={props.message.uri} initialTab="reactions" initialReaction={imageUrl} />)
                        }}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '8px',
                            padding: '0 8px',
                            minWidth: '64px',
                            minHeight: '26px',
                            borderRadius: CssVar.round(1),
                            border: isOwn ? `1.5px solid ${CssVar.contentLink}` : `1px solid ${CssVar.divider}`,
                            backgroundColor: isOwn ? `rgb(from ${CssVar.contentLink} r g b / 0.15)` : 'transparent',
                            cursor: 'pointer',
                            color: CssVar.contentText,
                            fontSize: '1rem'
                        }}
                    >
                        <CCImage
                            src={imageUrl}
                            maxHeight={128}
                            alt=""
                            style={{
                                // width指定なし=アスペクト比維持(横長絵文字は潰さずそのまま伸ばす)
                                height: '20px'
                            }}
                        />
                        <span>{count}</span>
                    </ButtonBase>
                )
            })}
        </div>
    )
}
