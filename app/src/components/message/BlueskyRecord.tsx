import { Suspense, use, useMemo } from 'react'
import { BskyPostView, getPostImages, getPostExternal } from '../../utils/bluesky'
import { useStack } from '../../layouts/Stack'
import { MessageLayout } from './MessageLayout'
import { Avatar, CssVar, ExternalLink, Text } from '@concrnt/ui'
import { TimeDiff } from '../TimeDiff'
import { BskyView } from '../../views/BskyView'
import { useClient } from '../../contexts/Client'
import { MessageSkeleton } from './MessageSkeleton'
import { AtprotoRecordSchema, Message, RerouteMessageSchema } from '@concrnt/worldlib'
import { MessageFooter } from './Footer'

interface Props {
    atUri: string
    message?: Message<AtprotoRecordSchema>
    detail?: boolean
    rerouted?: Message<RerouteMessageSchema>
}

export const BlueskyRecord = (props: Props) => {
    const { client } = useClient()

    const postPromise = useMemo(() => {
        return client.api
            .callConcrntApi<BskyPostView>(client.server.domain, 'world.concrnt.atproto.resolve', { uri: props.atUri })
            .catch(() => null)
    }, [client, props.atUri])

    return (
        <Suspense fallback={<MessageSkeleton />}>
            <Post postPromise={postPromise} message={props.message} detail={props.detail} rerouted={props.rerouted} />
        </Suspense>
    )
}

const Post = (props: {
    postPromise: Promise<BskyPostView | null>
    message?: Message<AtprotoRecordSchema>
    detail?: boolean
    rerouted?: Message<RerouteMessageSchema>
}) => {
    const { push } = useStack()

    const post = use(props.postPromise)

    if (!post) {
        const override = props.message?.value.profileOverride
        return (
            <div
                style={{
                    padding: CssVar.space(2)
                }}
            >
                <Text>Post not found{override?.username ? ` (by ${override.username})` : ''}</Text>
            </div>
        )
    }

    const images = getPostImages(post)
    const external = getPostExternal(post)

    return (
        <MessageLayout
            detail={props.detail}
            onClick={() => {
                push(<BskyView uri={post.uri} />)
            }}
            left={
                <div
                    onClick={(e) => {
                        e.stopPropagation()
                        push(<BskyView uri={post.author.did} />)
                    }}
                >
                    <Avatar ccid={post.author.did} src={post.author.avatar} />
                </div>
            }
            headerLeft={
                <Text
                    style={{
                        fontWeight: 'bold'
                    }}
                >
                    {post.author.displayName || post.author.handle}
                </Text>
            }
            headerRight={post.record.createdAt && <TimeDiff date={new Date(post.record.createdAt)} />}
        >
            <Text
                style={{
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word'
                }}
            >
                {post.record.text ?? ''}
            </Text>
            {images.length > 0 && (
                <div
                    style={{
                        display: 'flex',
                        flexWrap: 'wrap',
                        gap: CssVar.space(1)
                    }}
                >
                    {images.map((image, i) => (
                        <img
                            key={i}
                            src={image.thumb}
                            alt={image.alt ?? ''}
                            style={{
                                maxWidth: '100%',
                                maxHeight: '300px',
                                borderRadius: '8px',
                                objectFit: 'contain'
                            }}
                        />
                    ))}
                </div>
            )}
            {external && (
                <ExternalLink
                    href={external.uri}
                    style={{
                        display: 'block',
                        border: `1px solid ${CssVar.divider}`,
                        borderRadius: '8px',
                        padding: CssVar.space(1),
                        textDecoration: 'none'
                    }}
                >
                    <Text style={{ fontWeight: 'bold' }}>{external.title || external.uri}</Text>
                    {external.description && <Text variant="caption">{external.description}</Text>}
                </ExternalLink>
            )}
            {props.message && <MessageFooter message={props.message} rerouted={props.rerouted} />}
        </MessageLayout>
    )
}
