import { Button } from '@concrnt/ui'
import { Association, LikeAssociationSchema, Schemas, type Message } from '@concrnt/worldlib'

import { MdStar } from 'react-icons/md'
import { MdStarOutline } from 'react-icons/md'
import { MdReply } from 'react-icons/md'
import { MdRepeat } from 'react-icons/md'
import { useClient } from '../../contexts/Client'
import { useComposer } from '../../contexts/Composer'
import { hapticLight } from '../../utils/haptics'
import { startTransition, useOptimistic } from 'react'

interface Props {
    message: Message<any>
}

interface LikeState {
    ownLike: Association<LikeAssociationSchema> | undefined
    count: number
}

export const MessageActions = (props: Props) => {
    const { client } = useClient()
    const composer = useComposer()

    const replyCount = props.message.associationCounts?.[Schemas.replyAssociation] ?? 0
    const rerouteCount = props.message.associationCounts?.[Schemas.rerouteAssociation] ?? 0

    const [likeState, updateLikeState] = useOptimistic<LikeState>({
        ownLike: props.message.ownAssociations.find((a) => a.schema === Schemas.likeAssociation),
        count: props.message.associationCounts?.[Schemas.likeAssociation] ?? 0
    })

    return (
        <div
            style={{
                display: 'flex',
                flexDirection: 'row',
                gap: '8px',
                alignItems: 'center'
            }}
        >
            {/* リプライボタン */}
            <Button
                variant="text"
                onClick={(e) => {
                    e.stopPropagation()
                    composer.open([], [], 'reply', props.message)
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
                    composer.open([], [], 'reroute', props.message)
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
                                await client.api.delete(likeState.ownLike.ccfs)
                            }
                        })
                    } else {
                        startTransition(async () => {
                            updateLikeState((prev: LikeState): LikeState => {
                                return {
                                    ownLike: new Association('dummy', {
                                        schema: Schemas.likeAssociation,
                                        value: {},
                                        author: client.ccid,
                                        createdAt: new Date()
                                    }),
                                    count: prev.count + 1
                                }
                            })
                            await props.message.favorite(client)
                        })
                    }
                }}
                style={{ display: 'flex', alignItems: 'center' }}
            >
                {likeState.ownLike ? <MdStar size={20} color="gold" /> : <MdStarOutline size={20} />}
                <span style={{ marginLeft: '4px' }}>{likeState.count}</span>
            </Button>
        </div>
    )
}
