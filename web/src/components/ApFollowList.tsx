import { Suspense, use, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Avatar, Button, Chip, Tab, Tabs, Text } from '@concrnt/ui'
import { NotFoundError, Document } from '@concrnt/client'
import { Schemas, ApFollowSchema } from '@concrnt/worldlib'
import { useClient } from '../contexts/Client'
import { useMediaProxy } from '../contexts/MediaProxy'
import { CssVar } from '../types/Theme'
import { ApObject, apFollowKey, resolveApObject } from '../utils/activitypub'
import { useNavigate } from 'react-router-dom'

// ブリッジのfollowing/followers APIはcc-requester認証で自分のentityを引く自分専用APIのため、
// AcknowledgeListと違い対象ユーザーは指定できない。
interface Props {
    initialTab?: 'following' | 'followers'
    onNavigate?: () => void
}

interface ApFollowingEntry {
    actorURI: string
    status: 'accepted' | 'pending'
}

interface Entry {
    actorURI: string
    status?: 'accepted' | 'pending'
}

export const ApFollowList = (props: Props) => {
    const { t } = useTranslation('', { keyPrefix: 'components.apFollowList' })
    const { client } = useClient()

    const [tab, setTab] = useState<'following' | 'followers'>(props.initialTab ?? 'following')

    const followingPromise = useMemo((): Promise<Entry[] | null> => {
        if (!client) return Promise.resolve(null)
        return client.api
            .callConcrntApi<ApFollowingEntry[]>(client.server.domain, 'net.concrnt.activitypub.following', {})
            .catch((err): null => {
                console.log(err)
                return null
            })
    }, [client])

    const followersPromise = useMemo((): Promise<Entry[] | null> => {
        if (!client) return Promise.resolve(null)
        return client.api
            .callConcrntApi<string[]>(client.server.domain, 'net.concrnt.activitypub.followers', {})
            .then((uris): Entry[] => uris.map((actorURI) => ({ actorURI })))
            .catch((err): null => {
                console.log(err)
                return null
            })
    }, [client])

    const entries = tab === 'following' ? followingPromise : followersPromise

    return (
        <div
            style={{
                display: 'flex',
                flexDirection: 'column'
            }}
        >
            <Tabs>
                <Tab
                    selected={tab === 'following'}
                    onClick={() => setTab('following')}
                    groupId="ap-follow-list-tabs"
                    style={{ color: CssVar.contentText }}
                >
                    {t('following')}
                </Tab>
                <Tab
                    selected={tab === 'followers'}
                    onClick={() => setTab('followers')}
                    groupId="ap-follow-list-tabs"
                    style={{ color: CssVar.contentText }}
                >
                    {t('followers')}
                </Tab>
            </Tabs>
            <Suspense
                key={tab}
                fallback={
                    <div style={{ padding: CssVar.space(2) }}>
                        <Text variant="caption">Loading...</Text>
                    </div>
                }
            >
                <ActorList entriesPromise={entries} onNavigate={props.onNavigate} />
            </Suspense>
        </div>
    )
}

const ActorList = (props: { entriesPromise: Promise<Entry[] | null>; onNavigate?: () => void }) => {
    const { t } = useTranslation('', { keyPrefix: 'components.apFollowList' })

    const entries = use(props.entriesPromise)

    // 一覧APIは全件返すので、リモートサーバーへのresolveだけを行の表示単位でページングする
    const [visibleCount, setVisibleCount] = useState(20)

    return (
        <div
            style={{
                padding: CssVar.space(2)
            }}
        >
            {entries === null ? (
                <Text variant="caption">{t('loadError')}</Text>
            ) : entries.length === 0 ? (
                <Text variant="caption">{t('empty')}</Text>
            ) : (
                <div
                    style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: CssVar.space(2)
                    }}
                >
                    {entries.slice(0, visibleCount).map((entry) => (
                        <ActorRow key={entry.actorURI} entry={entry} onNavigate={props.onNavigate} />
                    ))}
                    {visibleCount < entries.length && (
                        <Button
                            onClick={() => {
                                setVisibleCount((c) => c + 20)
                            }}
                        >
                            {t('loadMore')}
                        </Button>
                    )}
                </div>
            )}
        </div>
    )
}

const ActorRow = (props: { entry: Entry; onNavigate?: () => void }) => {
    const { t } = useTranslation('', { keyPrefix: 'components.apFollowList' })
    const { client } = useClient()
    const { getImageURL } = useMediaProxy()
    const navigate = useNavigate()

    const [actor, setActor] = useState<ApObject | null | undefined>(undefined)
    const [followed, setFollowed] = useState<boolean | undefined>(undefined)
    const [hovered, setHovered] = useState(false)

    useEffect(() => {
        resolveApObject(client, props.entry.actorURI)
            .then(setActor)
            .catch((err) => {
                console.log(err)
                setActor(null)
            })

        client.api
            .getDocument(apFollowKey(client.ccid, props.entry.actorURI))
            .then(() => {
                setFollowed(true)
            })
            .catch((err) => {
                if (err instanceof NotFoundError) {
                    setFollowed(false)
                } else {
                    console.log(err)
                }
            })
    }, [client, props.entry.actorURI])

    const toggleFollow = () => {
        if (followed) {
            client.api
                .delete(apFollowKey(client.ccid, props.entry.actorURI))
                .then(() => {
                    setFollowed(false)
                })
                .catch((err) => {
                    console.log(err)
                })
        } else {
            const document: Document<ApFollowSchema> = {
                kind: 'record',
                key: apFollowKey(client.ccid, props.entry.actorURI),
                author: client.ccid,
                schema: Schemas.apFollow,
                value: {
                    actorURI: props.entry.actorURI
                },
                createdAt: new Date(),
                onUpdate: 'forget'
            }
            client.api
                .commit(document)
                .then(() => {
                    setFollowed(true)
                })
                .catch((err) => {
                    console.log(err)
                })
        }
    }

    // resolveに失敗した(消滅済み等)actorも行としては残し、生のURIで表示する
    const handle =
        actor?.preferredUsername && actor.id
            ? `@${actor.preferredUsername}@${new URL(actor.id).host}`
            : props.entry.actorURI

    const openActor = () => {
        navigate('/activitypub/view/' + encodeURIComponent(props.entry.actorURI))
        props.onNavigate?.()
    }

    return (
        <div
            style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: CssVar.space(1)
            }}
        >
            <Avatar
                ccid={props.entry.actorURI}
                src={getImageURL(actor?.getIcons()[0]?.url, { maxWidth: 96 })}
                style={{
                    width: '48px',
                    height: '48px',
                    cursor: 'pointer',
                    flexShrink: 0
                }}
                onClick={openActor}
            />
            <div
                style={{
                    display: 'flex',
                    flexDirection: 'column',
                    flex: 1,
                    minWidth: 0,
                    cursor: 'pointer'
                }}
                onClick={openActor}
            >
                <div
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: CssVar.space(1)
                    }}
                >
                    <Text
                        variant="h6"
                        style={{
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap'
                        }}
                    >
                        {actor?.name || actor?.preferredUsername || props.entry.actorURI}
                    </Text>
                    {props.entry.status === 'pending' && (
                        <Chip
                            variant="outlined"
                            style={{
                                fontSize: '12px',
                                height: '20px',
                                color: CssVar.contentText
                            }}
                        >
                            {t('pending')}
                        </Chip>
                    )}
                </div>
                <Text
                    variant="caption"
                    style={{
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap'
                    }}
                >
                    {handle}
                </Text>
            </div>
            {followed !== undefined && (
                <div
                    onMouseEnter={() => setHovered(true)}
                    onMouseLeave={() => setHovered(false)}
                    style={{ flexShrink: 0 }}
                >
                    <Button variant={followed ? 'outlined' : 'contained'} onClick={toggleFollow}>
                        {followed ? (hovered ? t('unfollow') : t('following')) : t('follow')}
                    </Button>
                </div>
            )}
        </div>
    )
}
