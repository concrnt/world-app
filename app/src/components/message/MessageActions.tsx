import { Button, Text } from '@concrnt/ui'
import { Association, LikeAssociationSchema, Schemas, type Message } from '@concrnt/worldlib'
import { useClient } from '../../contexts/Client'
import { useComposer } from '../../contexts/Composer'
import { hapticLight, hapticSuccess } from '../../utils/haptics'
import { startTransition, useOptimistic } from 'react'
import { useSelect } from '../../contexts/Select'
import { Report } from '../Report'

import { MdStar } from 'react-icons/md'
import { MdStarOutline } from 'react-icons/md'
import { MdReply } from 'react-icons/md'
import { MdRepeat } from 'react-icons/md'
import { MdMoreHoriz } from 'react-icons/md'
import { useDrawer } from '../../contexts/Drawer'
import { useConfirm } from '../../contexts/Confirm'

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
    const { select } = useSelect()
    const drawer = useDrawer()
    const confirm = useConfirm()

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
                    composer.open(communityDestinations, [], 'reply', props.message)
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
                    composer.open(communityDestinations, [], 'reroute', props.message)
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
            {/* メニュー */}
            <Button
                variant="text"
                onClick={(e) => {
                    e.stopPropagation()
                    select(
                        '',
                        {
                            delete: <Text>投稿を削除</Text>,
                            report: <Text>投稿を通報</Text>
                        },
                        (key) => {
                            switch (key) {
                                case 'delete':
                                    confirm.open(
                                        '本当にこの投稿を削除しますか？',
                                        () => {
                                            client?.api.delete(props.message.uri).then(() => hapticSuccess())
                                        },
                                        {
                                            confirmText: '削除'
                                        }
                                    )
                                    break
                                case 'report':
                                    drawer.open(
                                        <Report
                                            targetURI={props.message.uri}
                                            onSend={() => {
                                                drawer.close()
                                                hapticSuccess()
                                            }}
                                        />
                                    )
                            }
                        }
                    )
                }}
            >
                <MdMoreHoriz size={20} />
            </Button>
        </div>
    )
}
