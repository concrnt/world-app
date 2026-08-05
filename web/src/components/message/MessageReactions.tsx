import { Association, Message, ReactionAssociationSchema, Schemas, User } from '@concrnt/worldlib'
import { Document } from '@concrnt/client'
import { useClient } from '../../contexts/Client'
import { CssVar } from '../../types/Theme'
import { hapticLight } from '../../utils/haptics'
import { startTransition, useEffect, useState } from 'react'
import { ReactionState } from './Footer'
import { Avatar, CCImage, Divider, Tooltip } from '@concrnt/ui'
import { useQueryTimelineContext } from '../QueryTimeline'

// app版との意図的な差分: appはButtonBase+長押しでリアクション一覧へ遷移、
// webは素のbutton+hoverでリアクションした人をtooltip表示する(tooltipはweb限定機能)

interface Props {
    message: Message<any>
    reactionState: ReactionState
    updateReactionState: React.Dispatch<React.SetStateAction<ReactionState>>
}

export const MessageReactions = (props: Props) => {
    const { client } = useClient()
    const qt = useQueryTimelineContext()
    const messageHref = props.message.key ?? props.message.uri

    const { reactionCounts, ownReactions } = props.reactionState

    const [reactionMembers, setReactionMembers] = useState<
        Record<string, Array<Association<ReactionAssociationSchema>>>
    >({})

    // hoverのたびに再フェッチして上書きする(初回のみローディング表示、
    // 2回目以降は旧データを見せつつ裏で更新するのでstaleが残らない)
    const loadReactionMembers = async (imageUrl: string) => {
        if (!client) return
        const sds = await client.api
            .getAssociationsAll(props.message.uri, {
                schema: Schemas.reactionAssociation,
                variant: imageUrl
            })
            .catch((e) => {
                console.error('Failed to fetch reaction members:', e)
                return []
            })
        const members = sds.map((sd) => Association.fromSignedDocument(sd)) as Array<
            Association<ReactionAssociationSchema>
        >
        setReactionMembers((prev) => ({ ...prev, [imageUrl]: members }))
    }

    // commit完了後、transitionが終わる(=useOptimisticがrevertする)前に
    // メッセージ本体を再取得してベース値をサーバー状態に揃える。
    // これをsocketイベント任せにすると、イベントがcommit応答より遅れたときに
    // 一瞬リアクションが消える
    const refreshMessage = async () => {
        qt.update(messageHref)
        await client?.getMessage(messageHref).catch(() => null)
    }

    const handleReactionClick = async (imageUrl: string) => {
        if (!client) return
        if (client.ccid === '') return // ゲストはリアクション不可(表示のみ)
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
                gap: '6px'
            }}
        >
            {Object.entries(reactionCounts).map(([imageUrl, count]) => {
                const isOwn = !!ownReactions[imageUrl]
                return (
                    <Tooltip
                        key={imageUrl}
                        onOpen={() => loadReactionMembers(imageUrl)}
                        content={
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    <CCImage
                                        src={imageUrl}
                                        maxHeight={128}
                                        alt=""
                                        style={{
                                            height: '20px'
                                        }}
                                    />
                                    <span style={{ fontSize: '12px' }}>
                                        {reactionMembers[imageUrl]?.[0]?.value.shortcode ?? '...'}
                                    </span>
                                </div>
                                <Divider />
                                {reactionMembers[imageUrl]?.map((member) => (
                                    <ReactionUserRow key={member.ccfs} association={member} />
                                ))}
                            </div>
                        }
                    >
                        <button
                            onClick={(e) => {
                                e.stopPropagation()
                                handleReactionClick(imageUrl)
                            }}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px',
                                padding: '2px 8px',
                                borderRadius: CssVar.round(1),
                                border: isOwn ? `1.5px solid ${CssVar.contentLink}` : `1px solid ${CssVar.divider}`,
                                backgroundColor: isOwn ? `rgb(from ${CssVar.contentLink} r g b / 0.15)` : 'transparent',
                                cursor: 'pointer',
                                color: CssVar.contentText,
                                fontSize: '13px',
                                WebkitTapHighlightColor: 'transparent'
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
                        </button>
                    </Tooltip>
                )
            })}
        </div>
    )
}

const ReactionUserRow = (props: { association: Association<ReactionAssociationSchema> }) => {
    const { client } = useClient()
    const [user, setUser] = useState<User | null>(null)

    useEffect(() => {
        client?.getUser(props.association.author).then((u) => setUser(u))
    }, [props.association.author, client])

    // APブリッジ経由のリアクションはprofileOverrideに元のプロフィールが入っている
    const override = props.association.value.profileOverride

    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <Avatar
                ccid={props.association.author}
                src={override?.avatar ?? user?.profile.avatar}
                style={{ width: '18px', height: '18px' }}
            />
            <span style={{ fontSize: '12px' }}>{override?.username ?? user?.profile.username ?? 'Anonymous'}</span>
        </div>
    )
}
