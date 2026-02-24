import { useClient } from '../../contexts/Client'
import { useStack } from '../../layouts/Stack'
import { MessageProps } from './types'
import { MarkdownMessageSchema, Schemas } from '@concrnt/worldlib'

import { ProfileView } from '../../views/Profile'
import { PostView } from '../../views/Post'

import { Avatar, Button, CfmRenderer, Text, IconButton } from '@concrnt/ui'

import { MdMoreHoriz } from 'react-icons/md'
import { MdStar } from 'react-icons/md'
import { MdStarOutline } from 'react-icons/md'
import { useSelect } from '../../contexts/Select'

export const MarkdownMessage = (props: MessageProps<MarkdownMessageSchema>) => {
    const { push } = useStack()
    const { client } = useClient()
    const { select } = useSelect()

    const message = props.message

    const ownFavorite = message.ownAssociations.find((a) => a.schema === Schemas.likeAssociation)
    const likeCount = message.associationCounts?.[Schemas.likeAssociation] ?? 0

    return (
        <div
            style={{
                display: 'flex',
                flexDirection: 'row',
                gap: '8px',
                contentVisibility: 'auto'
            }}
            onClick={(e) => {
                e.stopPropagation()
                push(<PostView uri={message.uri} />)
            }}
        >
            <div
                onClick={(e) => {
                    e.stopPropagation()
                    push(<ProfileView id={message.author} />)
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
                <div>
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
