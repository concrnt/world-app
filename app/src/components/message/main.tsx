import { ReactNode, Suspense, use, useMemo } from 'react'
import { IsCCID, parseCCURI } from '@concrnt/client'

import { useClient } from '../../contexts/Client'
import { useSelect } from '../../contexts/Select'

import { useStack } from '../../layouts/Stack'

import { ProfileView } from '../../views/Profile'
import { PostView } from '../../views/Post'

import { CfmRenderer } from '../../ui/CfmRenderer'
import { Avatar } from '../../ui/Avatar'
import { Text } from '../../ui/Text'
import { IconButton } from '../../ui/IconButton'

import { MdMoreHoriz } from 'react-icons/md'
import { MdStar } from 'react-icons/md'
import { MdStarOutline } from 'react-icons/md'
import { Message, Schemas } from '@concrnt/worldlib'
import { Button } from '../../ui/Button'

interface Props {
    uri: string
    source?: string
    lastUpdated?: number
}

export const MessageContainer = (props: Props): ReactNode | null => {
    const { client } = useClient()

    const messagePromise = useMemo(() => {
        console.log('Fetching message', props.uri)

        const fetchHint = async () => {
            let hint: string | undefined = undefined
            try {
                if (props.source) {
                    const { owner } = parseCCURI(props.source)
                    if (IsCCID(owner)) {
                        const user = await client?.getUser(owner)
                        if (user) {
                            hint = user.domain
                        }
                    } else {
                        hint = owner
                    }
                }
            } catch (e) {
                console.error('Failed to resolve hint for message', e)
            }

            return hint
        }

        return fetchHint().then((hint) => {
            return client!.getMessage<any>(props.uri, hint).catch(() => undefined)
        })
    }, [client, props.uri, props.source])

    return (
        <Suspense fallback={<div>Loading message...</div>}>
            <MessageContainerInner messagePromise={messagePromise} />
        </Suspense>
    )
}

interface InnerProps {
    messagePromise: Promise<any>
}

const MessageContainerInner = (props: InnerProps) => {
    const { push } = useStack()

    const { client } = useClient()
    const message: Message<any> = use(props.messagePromise)

    const { select } = useSelect()

    if (!message) return <div>Message not found</div>

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
