import { Suspense, use, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Avatar, Button, Tab, Tabs, Text } from '@concrnt/ui'
import { NotFoundError, Document } from '@concrnt/client'
import { Schemas, AtprotoFollowSchema } from '@concrnt/worldlib'
import { useClient } from '../contexts/Client'
import { useMediaProxy } from '../contexts/MediaProxy'
import { CssVar } from '../types/Theme'
import { BskyProfile, followKey } from '../utils/bluesky'
import { useStack } from '../layouts/Stack'
import { BskyView } from '../views/BskyView'

// atprotoブリッジのfollowing/followers APIはcc-requester認証で自分のentityを引く自分専用APIのため、
// ApFollowListと同様に対象ユーザーは指定できない。
// followingはブリッジのDBから全件、followersはappviewのページング(cursor)をそのまま使う。
interface Props {
    initialTab?: 'following' | 'followers'
    onNavigate?: () => void
}

interface FollowersPage {
    followers: BskyProfile[]
    cursor?: string
}

export const BskyFollowList = (props: Props) => {
    const { t } = useTranslation('', { keyPrefix: 'components.bskyFollowList' })
    const { client } = useClient()

    const [tab, setTab] = useState<'following' | 'followers'>(props.initialTab ?? 'following')

    const followingPromise = useMemo((): Promise<BskyProfile[] | null> => {
        if (!client) return Promise.resolve(null)
        return client.api
            .callConcrntApi<{ following: BskyProfile[] }>(client.server.domain, 'world.concrnt.atproto.following', {})
            .then((res) => res.following ?? [])
            .catch((err): null => {
                console.log(err)
                return null
            })
    }, [client])

    const followersPromise = useMemo((): Promise<FollowersPage | null> => {
        if (!client) return Promise.resolve(null)
        return client.api
            .callConcrntApi<FollowersPage>(client.server.domain, 'world.concrnt.atproto.followers', {})
            .then((res) => ({ followers: res.followers ?? [], cursor: res.cursor }))
            .catch((err): null => {
                console.log(err)
                return null
            })
    }, [client])

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
                    groupId="bsky-follow-list-tabs"
                    style={{ color: CssVar.contentText }}
                >
                    {t('following')}
                </Tab>
                <Tab
                    selected={tab === 'followers'}
                    onClick={() => setTab('followers')}
                    groupId="bsky-follow-list-tabs"
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
                {tab === 'following' ? (
                    <FollowingList profilesPromise={followingPromise} onNavigate={props.onNavigate} />
                ) : (
                    <FollowersList firstPagePromise={followersPromise} onNavigate={props.onNavigate} />
                )}
            </Suspense>
        </div>
    )
}

const FollowingList = (props: { profilesPromise: Promise<BskyProfile[] | null>; onNavigate?: () => void }) => {
    const { t } = useTranslation('', { keyPrefix: 'components.bskyFollowList' })

    const profiles = use(props.profilesPromise)

    // 一覧APIは全件返すので、表示行数だけをページングする
    const [visibleCount, setVisibleCount] = useState(20)

    return (
        <div
            style={{
                padding: CssVar.space(2)
            }}
        >
            {profiles === null ? (
                <Text variant="caption">{t('loadError')}</Text>
            ) : profiles.length === 0 ? (
                <Text variant="caption">{t('empty')}</Text>
            ) : (
                <div
                    style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: CssVar.space(2)
                    }}
                >
                    {profiles.slice(0, visibleCount).map((profile) => (
                        <ProfileRow key={profile.did} profile={profile} onNavigate={props.onNavigate} />
                    ))}
                    {visibleCount < profiles.length && (
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

const FollowersList = (props: { firstPagePromise: Promise<FollowersPage | null>; onNavigate?: () => void }) => {
    const { t } = useTranslation('', { keyPrefix: 'components.bskyFollowList' })
    const { client } = useClient()

    const firstPage = use(props.firstPagePromise)

    // 2ページ目以降はappviewのcursorで追い読みする
    const [more, setMore] = useState<BskyProfile[]>([])
    const [cursor, setCursor] = useState(firstPage?.cursor)
    const [loading, setLoading] = useState(false)

    const loadMore = () => {
        if (!cursor || loading) return
        setLoading(true)
        client.api
            .callConcrntApi<FollowersPage>(client.server.domain, 'world.concrnt.atproto.followers', { cursor })
            .then((res) => {
                setMore((prev) => [...prev, ...(res.followers ?? [])])
                setCursor(res.cursor)
            })
            .catch((err) => {
                console.log(err)
            })
            .finally(() => {
                setLoading(false)
            })
    }

    const profiles = firstPage ? [...firstPage.followers, ...more] : null

    return (
        <div
            style={{
                padding: CssVar.space(2)
            }}
        >
            {profiles === null ? (
                <Text variant="caption">{t('loadError')}</Text>
            ) : profiles.length === 0 ? (
                <Text variant="caption">{t('empty')}</Text>
            ) : (
                <div
                    style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: CssVar.space(2)
                    }}
                >
                    {profiles.map((profile) => (
                        <ProfileRow key={profile.did} profile={profile} onNavigate={props.onNavigate} />
                    ))}
                    {cursor && (
                        <Button disabled={loading} onClick={loadMore}>
                            {t('loadMore')}
                        </Button>
                    )}
                </div>
            )}
        </div>
    )
}

const ProfileRow = (props: { profile: BskyProfile; onNavigate?: () => void }) => {
    const { t } = useTranslation('', { keyPrefix: 'components.bskyFollowList' })
    const { client } = useClient()
    const { getImageURL } = useMediaProxy()
    const stack = useStack()

    const [followed, setFollowed] = useState<boolean | undefined>(undefined)
    const [hovered, setHovered] = useState(false)

    useEffect(() => {
        client.api
            .getDocument(followKey(client.ccid, props.profile.did))
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
    }, [client, props.profile.did])

    const toggleFollow = () => {
        if (followed) {
            client.api
                .delete(followKey(client.ccid, props.profile.did))
                .then(() => {
                    setFollowed(false)
                })
                .catch((err) => {
                    console.log(err)
                })
        } else {
            const document: Document<AtprotoFollowSchema> = {
                kind: 'record',
                key: followKey(client.ccid, props.profile.did),
                author: client.ccid,
                schema: Schemas.atprotoFollow,
                value: {
                    did: props.profile.did
                },
                createdAt: new Date()
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

    // ブリッジがプロフィールを解決できていない(消滅済み等)相手も行としては残し、生のDIDで表示する
    const handle = props.profile.handle ? `@${props.profile.handle}` : props.profile.did

    const openProfile = () => {
        stack.push(<BskyView uri={props.profile.did} />)
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
                ccid={props.profile.did}
                src={getImageURL(props.profile.avatar, { maxWidth: 96 })}
                style={{
                    width: '48px',
                    height: '48px',
                    cursor: 'pointer',
                    flexShrink: 0
                }}
                onClick={openProfile}
            />
            <div
                style={{
                    display: 'flex',
                    flexDirection: 'column',
                    flex: 1,
                    minWidth: 0,
                    cursor: 'pointer'
                }}
                onClick={openProfile}
            >
                <Text
                    variant="h6"
                    style={{
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap'
                    }}
                >
                    {props.profile.displayName || props.profile.handle || props.profile.did}
                </Text>
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
