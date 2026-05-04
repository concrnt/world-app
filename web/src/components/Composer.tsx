import { useEffect, useRef, useState } from 'react'
import { Button, CssVar, Divider, Text } from '@concrnt/ui'
import { Schemas, semantics, type Message } from '@concrnt/worldlib'
import { useClient } from '../contexts/Client'
import type { ComposerMode } from '../contexts/Composer'
import { useSubscribe } from '../hooks/useSubscribe'
import { TimelinePicker } from './TimelinePicker'
import { uploadImage } from '../util/uploadImage'

interface MediaDraft {
    file: File
    previewUrl: string
}

interface Props {
    initialDestinations?: string[]
    mode?: ComposerMode
    targetMessage?: Message<unknown>
    onPosted?: () => void
}

export const Composer = (props: Props) => {
    const { client } = useClient()
    const [knownCommunities] = useSubscribe(client!.knownCommunities)
    const [draft, setDraft] = useState('')
    const [postHome, setPostHome] = useState(true)
    const [destinations, setDestinations] = useState<string[]>(props.initialDestinations ?? [])
    const [mediaDrafts, setMediaDrafts] = useState<MediaDraft[]>([])
    const [processing, setProcessing] = useState(false)
    const fileInputRef = useRef<HTMLInputElement | null>(null)

    useEffect(() => {
        return () => {
            mediaDrafts.forEach((media) => URL.revokeObjectURL(media.previewUrl))
        }
    }, [mediaDrafts])

    if (!client) return null

    const mode = props.mode ?? 'normal'

    const submitLabel =
        mode === 'reply' ? 'リプライする' : mode === 'reroute' ? 'リルートする' : processing ? '投稿中...' : '投稿する'

    const createDistributes = () => {
        const homeTimeline = semantics.homeTimeline(client.ccid, client.currentProfile)
        return [...new Set([...(postHome ? [homeTimeline] : []), ...destinations])]
    }

    const commitReplyAssociation = async (message: Message<unknown>, replyUri: string) => {
        const targetAuthorDomain = await client.getUser(message.author).then((user) => user?.domain)
        const notifyTimeline = semantics.notificationTimeline(message.author, message.authorProfileName || 'main')
        await client.api.commit(
            {
                author: client.ccid,
                schema: Schemas.replyAssociation,
                associate: message.uri,
                value: {
                    messageId: replyUri
                },
                distributes: [semantics.activityTimeline(client.ccid, client.currentProfile), notifyTimeline],
                createdAt: new Date()
            },
            targetAuthorDomain
        )
    }

    const commitRerouteAssociation = async (message: Message<unknown>, rerouteUri: string) => {
        const targetAuthorDomain = await client.getUser(message.author).then((user) => user?.domain)
        const notifyTimeline = semantics.notificationTimeline(message.author, message.authorProfileName || 'main')
        await client.api.commit(
            {
                author: client.ccid,
                schema: Schemas.rerouteAssociation,
                associate: message.uri,
                value: {
                    messageId: rerouteUri
                },
                distributes: [semantics.activityTimeline(client.ccid, client.currentProfile), notifyTimeline],
                createdAt: new Date()
            },
            targetAuthorDomain
        )
    }

    const handleSubmit = async () => {
        if (processing || (!draft.trim() && mediaDrafts.length === 0 && mode === 'normal')) return

        const distributes = createDistributes()
        const key = Date.now().toString()
        const newPostUri = semantics.post(client.ccid, client.currentProfile, key)

        setProcessing(true)

        try {
            if (mode === 'reply' && props.targetMessage) {
                await client.api.commit({
                    key: newPostUri,
                    schema: Schemas.replyMessage,
                    value: {
                        body: draft,
                        replyToMessageId: props.targetMessage.uri,
                        replyToMessageAuthor: props.targetMessage.author
                    },
                    author: client.ccid,
                    distributes,
                    createdAt: new Date()
                })
                await commitReplyAssociation(props.targetMessage, newPostUri)
            } else if (mode === 'reroute' && props.targetMessage) {
                await client.api.commit({
                    key: newPostUri,
                    schema: Schemas.rerouteMessage,
                    value: {
                        body: draft,
                        rerouteMessageId: props.targetMessage.uri,
                        rerouteMessageAuthor: props.targetMessage.author
                    },
                    author: client.ccid,
                    distributes,
                    createdAt: new Date()
                })
                await commitRerouteAssociation(props.targetMessage, newPostUri)
            } else if (mediaDrafts.length > 0) {
                const medias = await Promise.all(
                    mediaDrafts.map(async (media) => ({
                        mediaURL: await uploadImage(client, media.file),
                        mediaType: media.file.type
                    }))
                )

                await client.api.commit({
                    key: newPostUri,
                    schema: Schemas.mediaMessage,
                    value: {
                        body: draft,
                        medias
                    },
                    author: client.ccid,
                    distributes,
                    createdAt: new Date()
                })
            } else {
                await client.api.commit({
                    key: newPostUri,
                    schema: Schemas.markdownMessage,
                    value: {
                        body: draft
                    },
                    author: client.ccid,
                    distributes,
                    createdAt: new Date()
                })
            }

            setDraft('')
            props.onPosted?.()
        } finally {
            setProcessing(false)
        }
    }

    return (
        <div
            style={{
                display: 'flex',
                flexDirection: 'column',
                gap: CssVar.space(3),
                padding: CssVar.space(4),
                overflowY: 'auto'
            }}
        >
            <div style={{ display: 'flex', flexDirection: 'column', gap: CssVar.space(2) }}>
                <Text variant="h3">投稿先</Text>
                <TimelinePicker
                    items={knownCommunities}
                    selected={destinations}
                    setSelected={setDestinations}
                    keyFunc={(item) => item.uri}
                    labelFunc={(item) => item.name}
                    postHome={postHome}
                    setPostHome={setPostHome}
                />
            </div>

            {props.targetMessage && (
                <div
                    style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: CssVar.space(1),
                        padding: CssVar.space(3),
                        border: `1px solid ${CssVar.divider}`,
                        borderRadius: CssVar.round(1)
                    }}
                >
                    <Text variant="caption">
                        {mode === 'reply' ? '返信先' : 'リルート元'}: {props.targetMessage.authorProfile.username}
                    </Text>
                    {'body' in (props.targetMessage.value as Record<string, unknown>) && (
                        <Text>{String((props.targetMessage.value as Record<string, unknown>).body ?? '')}</Text>
                    )}
                </div>
            )}

            <textarea
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                placeholder={mode === 'reply' ? '返信を書く' : mode === 'reroute' ? 'コメントを添える' : 'いま何を共有しますか？'}
                style={{
                    width: '100%',
                    minHeight: 120,
                    padding: CssVar.space(3),
                    borderRadius: CssVar.round(1),
                    border: `1px solid ${CssVar.divider}`,
                    color: CssVar.contentText,
                    backgroundColor: CssVar.contentBackground,
                    resize: 'vertical',
                    boxSizing: 'border-box'
                }}
            />

            {mediaDrafts.length > 0 && (
                <div
                    style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
                        gap: CssVar.space(2)
                    }}
                >
                    {mediaDrafts.map((media, index) => (
                        <div
                            key={media.previewUrl}
                            style={{
                                display: 'flex',
                                flexDirection: 'column',
                                gap: CssVar.space(2)
                            }}
                        >
                            <img
                                src={media.previewUrl}
                                alt=""
                                style={{
                                    width: '100%',
                                    aspectRatio: '1',
                                    objectFit: 'cover',
                                    borderRadius: CssVar.round(1)
                                }}
                            />
                            <Button
                                variant="outlined"
                                onClick={() => {
                                    URL.revokeObjectURL(media.previewUrl)
                                    setMediaDrafts((current) => current.filter((_, currentIndex) => currentIndex !== index))
                                }}
                            >
                                削除
                            </Button>
                        </div>
                    ))}
                </div>
            )}

            <Divider />

            <div
                style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: CssVar.space(2)
                }}
            >
                <div>
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        multiple
                        style={{ display: 'none' }}
                        onChange={(event) => {
                            const files = Array.from(event.target.files ?? [])
                            const nextDrafts = files
                                .filter((file) => file.type.startsWith('image/'))
                                .map((file) => ({
                                    file,
                                    previewUrl: URL.createObjectURL(file)
                                }))
                            setMediaDrafts((current) => current.concat(nextDrafts))
                            event.target.value = ''
                        }}
                    />
                    <Button
                        variant="outlined"
                        onClick={() => {
                            fileInputRef.current?.click()
                        }}
                    >
                        画像を追加
                    </Button>
                </div>
                <Button disabled={processing} onClick={() => void handleSubmit()}>
                    {submitLabel}
                </Button>
            </div>
        </div>
    )
}
