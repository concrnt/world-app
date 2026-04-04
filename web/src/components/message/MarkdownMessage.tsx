import { useClient } from '../../contexts/Client'
import { type MessageProps } from './types'
import { type MarkdownMessageSchema, Schemas } from '@concrnt/worldlib'

import { Avatar, Button, CfmRenderer, IconButton } from '@concrnt/ui'

import { MdMoreHoriz } from 'react-icons/md'
import { MdStar } from 'react-icons/md'
import { MdStarOutline } from 'react-icons/md'
import { MdReply } from 'react-icons/md'
import { MdRepeat } from 'react-icons/md'

export const MarkdownMessage = (props: MessageProps<MarkdownMessageSchema>) => {
    const { client } = useClient()

    const message = props.message

    const ownFavorite = message.ownAssociations.find((a) => a.schema === Schemas.likeAssociation)
    const likeCount = message.associationCounts?.[Schemas.likeAssociation] ?? 0
    const replyCount = message.associationCounts?.[Schemas.replyAssociation] ?? 0
    const rerouteCount = message.associationCounts?.[Schemas.rerouteAssociation] ?? 0

    return (
        <div
            style={{
                display: 'flex',
                flexDirection: 'row',
                gap: '8px'
            }}
            onClick={(e) => {
                e.stopPropagation()
                // push(<PostView uri={message.uri} />)
            }}
        >
            <div
                onClick={(e) => {
                    e.stopPropagation()
                    // push(<ProfileView id={message.author} />)
                }}
            >
                <Avatar ccid={message.author} src={message.authorUser?.profile.avatar} />
            </div>
            <div
                style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px',
                    flex: 1
                }}
            >
                <div
                    style={{
                        display: 'flex',
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '8px'
                    }}
                >
                    <div
                        style={{
                            fontWeight: 'bold'
                        }}
                    >
                        {message.authorUser?.profile.username}
                    </div>
                    <IconButton
                        onClick={(e) => {
                            e.stopPropagation()
                            /*
                            select(
                                '',
                                {
                                    delete: <Text>投稿を削除</Text>
                                },
                                (key) => {
                                    if (key === 'delete') {
                                        client?.api.delete(message.uri)
                                    }
                                }
                            )
                            */
                        }}
                        style={{
                            padding: 0,
                            margin: 0
                        }}
                    >
                        <MdMoreHoriz size={15} />
                    </IconButton>
                </div>
                <CfmRenderer messagebody={message.value.body} emojiDict={{}} />
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
                            // composer.open([], [], 'reply', message)
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
                            // composer.open([], [], 'reroute', message)
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
                            if (ownFavorite) {
                                //client?.unfavorite(message)
                            } else {
                                message.favorite(client)
                            }
                        }}
                        style={{ display: 'flex', alignItems: 'center' }}
                    >
                        {ownFavorite ? <MdStar size={20} color="gold" /> : <MdStarOutline size={20} />}
                        <span style={{ marginLeft: '4px' }}>{likeCount}</span>
                    </Button>
                </div>
            </div>
        </div>
    )
}
