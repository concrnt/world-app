import { Suspense, use, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
    Avatar,
    ButtonBase,
    CCWallpaper,
    CfmRenderer,
    Text,
    Button,
    Tabs,
    Tab,
    Divider,
    useTheme,
    Tooltip,
    IconButton
} from '@concrnt/ui'
import { View } from '../../components/View'
import { useClient } from '../../contexts/Client'
import { useNavigate } from 'react-router-dom'

import { QueryTimeline } from '../../components/QueryTimeline'
import { MediaGridTimeline } from '../../components/MediaGridTimeline'
import { usePersistent } from '../../hooks/usePersistent'
import { Document, PermissionError, renderUriTemplate } from '@concrnt/client'
import { ProfileSchema, Schemas, semantics, User } from '@concrnt/worldlib'
import { CssVar } from '../../types/Theme'
import { useSubscribe } from '../../hooks/useSubscribe'
import { ProfileName } from '../../components/ProfileName'
import { MdLock, MdDns, MdGridView, MdViewAgenda } from 'react-icons/md'
import { useMediaViewer } from '../../contexts/MediaViewer'
import { useMediaProxy } from '../../contexts/MediaProxy'

interface Props {
    ccid: string
    profileName?: string
    // 未知の外部ユーザーを解決するためのFQDN(explorer等、所在が分かっている経路から渡す)
    hint?: string
}

// views/Profile.tsx のゲスト(未ログイン)版。書き込みを伴うUI(編集・フォロー・ブロック等)を持たない
export const GuestProfileView = (props: Props) => {
    const { client } = useClient()

    const userPromise = useMemo(() => {
        return client.getUser(props.ccid, props.hint).catch(() => null)
    }, [client, props.ccid, props.hint])

    const profilePromise = useMemo<Promise<Document<ProfileSchema> | 'restricted'>>(() => {
        return client.api
            .getDocument<ProfileSchema>(semantics.profile(props.ccid, props.profileName ?? 'main'), props.hint)
            .catch((err): Document<ProfileSchema> | 'restricted' => {
                if (err instanceof PermissionError) {
                    return 'restricted'
                }
                const tmp: Document<ProfileSchema> = {
                    kind: 'record',
                    key: semantics.profile(props.ccid, props.profileName ?? 'main'),
                    schema: Schemas.profile,
                    author: props.ccid,
                    createdAt: new Date(),
                    value: {
                        username: 'Anonymous',
                        description: '',
                        avatar: '',
                        banner: ''
                    }
                }
                return tmp
            })
    }, [client, props.ccid, props.profileName, props.hint])

    return (
        <View>
            <Suspense>
                <Inner
                    ccid={props.ccid}
                    userPromise={userPromise}
                    profilePromise={profilePromise}
                    profileName={props.profileName ?? 'main'}
                />
            </Suspense>
        </View>
    )
}

interface InnerProps {
    ccid: string
    userPromise: Promise<User | null>
    profilePromise: Promise<Document<ProfileSchema> | 'restricted'>
    profileName: string
}

const Inner = (props: InnerProps) => {
    const { t } = useTranslation('', { keyPrefix: 'web.guestProfile' })
    const user = use(props.userPromise)
    const profile = use(props.profilePromise)

    if (user === null) {
        return (
            <>
                <meta name="robots" content="noindex" />
                <Text>{t('userNotFound')}</Text>
            </>
        )
    }

    if (profile === 'restricted') {
        return <RestrictedBody ccid={props.ccid} user={user} profileName={props.profileName} />
    }

    return <Body ccid={props.ccid} user={user} profile={profile} profileName={props.profileName} />
}

interface BodyProps {
    ccid: string
    user: User
    profile: Document<ProfileSchema>
    profileName: string
}

const Body = (props: BodyProps) => {
    const { client } = useClient()
    const { getImageURL } = useMediaProxy()
    const { t } = useTranslation('', { keyPrefix: 'web.guestProfile' })
    const [stats] = useSubscribe(props.user.stats)
    const profile = props.profile

    // --- クローラー向け: title/description/canonical と ProfilePage JSON-LD ---
    const profileURL =
        window.location.origin +
        '/profile/' +
        props.ccid +
        (props.profileName !== 'main' ? '/' + props.profileName : '')
    // ccfs://はクローラーが取得できないのでresolveエンドポイント(303でファイルへ)に変換する
    const resolveURL = (src?: string): string | undefined => {
        if (!src) return undefined
        if (!src.startsWith('ccfs://')) return src
        if (client.server && 'net.concrnt.core.resolve' in client.server.endpoints) {
            return `https://${client.api.defaultHost}${renderUriTemplate(client.server, 'net.concrnt.core.resolve', { uri: src })}`
        }
        return `https://${client.api.defaultHost}/api/v2/resolve?uri=${encodeURIComponent(src)}`
    }
    const username = profile.value.username ?? 'Anonymous'
    let description = (profile.value.description ?? '').replace(/!\[[^\]]*\]\(([^)]*)\)/g, '').trim()
    if (description.length > 300) description = description.slice(0, 300) + '…'
    const jsonLd = {
        '@context': 'https://schema.org',
        '@type': 'ProfilePage',
        dateCreated: new Date(profile.createdAt).toISOString(),
        mainEntity: {
            '@type': 'Person',
            identifier: props.ccid,
            name: username,
            alternateName: props.user.alias,
            description: profile.value.description,
            image: resolveURL(profile.value.avatar),
            url: profileURL,
            interactionStatistic: [
                {
                    '@type': 'InteractionCounter',
                    interactionType: 'https://schema.org/FollowAction',
                    userInteractionCount: stats.acknowledged
                }
            ],
            agentInteractionStatistic: [
                {
                    '@type': 'InteractionCounter',
                    interactionType: 'https://schema.org/FollowAction',
                    userInteractionCount: stats.acknowledging
                }
            ]
        }
    }

    const theme = useTheme()
    const navigate = useNavigate()
    const mediaViewer = useMediaViewer()

    const [tab, setTab] = useState<'posts' | 'media' | 'activity'>('posts')
    // Mediaタブの表示形式。端末ごとに記憶する
    const [mediaView, setMediaView] = usePersistent<'list' | 'grid'>('profile-media-view', 'grid')

    const target = useMemo(() => {
        switch (tab ?? '') {
            case 'posts':
                return {
                    prefix: semantics.homeTimeline(props.ccid, props.profileName ?? 'main') + '/',
                    query: {}
                }
            case 'media':
                return {
                    prefix: semantics.homeTimeline(props.ccid, props.profileName ?? 'main') + '/',
                    query: {
                        schema: Schemas.mediaMessage
                    }
                }
            case 'activity':
                return {
                    prefix: semantics.activityTimeline(props.ccid, props.profileName ?? 'main') + '/',
                    query: {}
                }
        }
    }, [props.ccid, props.profileName, tab])

    // グリッド/リスト両方のタイムラインで同じヘッダーを使うため持ち上げる
    const header = (
        <>
            <div
                style={{
                    position: 'relative'
                }}
            >
                <CCWallpaper
                    src={getImageURL(profile.value.banner)}
                    style={{
                        paddingTop: theme.variant === 'classic' ? 'env(safe-area-inset-top)' : undefined,
                        height: '150px'
                    }}
                />
                <div
                    style={{
                        position: 'absolute',
                        transform: 'translateY(-50%)',
                        left: CssVar.space(2),
                        width: '100px',
                        height: '100px'
                    }}
                >
                    <Avatar
                        ccid={props.ccid}
                        style={{
                            width: `100px`,
                            height: `100px`,
                            cursor: profile.value.avatar ? 'pointer' : undefined
                        }}
                        src={profile.value.avatar}
                        onClick={() => {
                            const avatar = profile.value.avatar
                            if (!avatar) return
                            mediaViewer.open([{ mediaURL: avatar, mediaType: 'image/*' }])
                        }}
                    />
                    {props.profileName !== 'main' && (
                        // サブプロフィール表示中はメインプロフィールのアバターを右下に重ね、クリックでメインへ遷移する
                        <div style={{ position: 'absolute', right: '-6px', bottom: '-6px' }}>
                            <Tooltip content={<Text>{t('mainProfile')}</Text>}>
                                <ButtonBase
                                    aria-label={t('mainProfile')}
                                    style={{
                                        padding: 0,
                                        borderRadius: '6px',
                                        border: `2px solid ${CssVar.contentBackground}`,
                                        backgroundColor: CssVar.contentBackground,
                                        display: 'block'
                                    }}
                                    onClick={() => navigate('/profile/' + props.ccid)}
                                >
                                    <Avatar
                                        ccid={props.ccid}
                                        src={props.user.profile.avatar}
                                        style={{ width: '32px', height: '32px' }}
                                    />
                                </ButtonBase>
                            </Tooltip>
                        </div>
                    )}
                </div>
            </div>
            <div
                style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: CssVar.space(2),
                    padding: `0 ${CssVar.space(2)}`
                }}
            >
                <div
                    style={{
                        minHeight: `50px`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'flex-end'
                    }}
                >
                    <Button variant="outlined" onClick={() => navigate('/login')}>
                        {t('loginToFollow')}
                    </Button>
                </div>
                <div>
                    <Text
                        variant="h6"
                        style={{
                            fontWeight: 'bold',
                            fontSize: '1.2rem'
                        }}
                    >
                        <ProfileName document={profile} />
                    </Text>
                    <Text>{props.user?.alias ? props.user.alias : null}</Text>
                </div>
                <div>
                    <Text variant="caption">{props.ccid}</Text>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: CssVar.space(0.5) }}>
                    <MdDns size={14} style={{ opacity: 0.7 }} />
                    <Text variant="caption">{props.user.domain}</Text>
                </div>
                <div style={{ wordBreak: 'break-word' }}>
                    {profile.value.description ? (
                        <CfmRenderer messagebody={profile.value.description} emojiDict={{}} />
                    ) : (
                        <Text>{t('noDescription')}</Text>
                    )}
                </div>
                <div
                    style={{
                        display: 'flex',
                        gap: CssVar.space(2)
                    }}
                >
                    <Text>{t('following', { n: stats.acknowledging })}</Text>
                    <Text>{t('followers', { n: stats.acknowledged })}</Text>
                </div>
            </div>
            <Tabs>
                <Tab
                    selected={tab === 'posts'}
                    onClick={() => setTab('posts')}
                    groupId="profile-tabs"
                    style={{
                        color: CssVar.contentText
                    }}
                >
                    Posts
                </Tab>
                <Tab
                    selected={tab === 'media'}
                    onClick={() => setTab('media')}
                    groupId="profile-tabs"
                    style={{
                        color: CssVar.contentText
                    }}
                >
                    Media
                </Tab>
                <Tab
                    selected={tab === 'activity'}
                    onClick={() => setTab('activity')}
                    groupId="profile-tabs"
                    style={{
                        color: CssVar.contentText
                    }}
                >
                    Activity
                </Tab>
            </Tabs>
            {tab === 'media' && (
                <>
                    <div
                        style={{
                            display: 'flex',
                            justifyContent: 'flex-end',
                            gap: CssVar.space(1),
                            padding: `${CssVar.space(1)} ${CssVar.space(2)}`
                        }}
                    >
                        <IconButton
                            title={t('mediaViewList')}
                            onClick={() => setMediaView('list')}
                            style={{ opacity: mediaView === 'list' ? 1 : 0.5 }}
                        >
                            <MdViewAgenda size={20} />
                        </IconButton>
                        <IconButton
                            title={t('mediaViewGrid')}
                            onClick={() => setMediaView('grid')}
                            style={{ opacity: mediaView === 'grid' ? 1 : 0.5 }}
                        >
                            <MdGridView size={20} />
                        </IconButton>
                    </div>
                    <Divider />
                </>
            )}
        </>
    )

    return (
        <>
            <title>{`${username} on Concrnt`}</title>
            {description !== '' && <meta name="description" content={description} />}
            <link rel="canonical" href={profileURL} />
            <script type="application/ld+json">{JSON.stringify(jsonLd)}</script>
            {tab === 'media' && mediaView === 'grid' ? (
                <MediaGridTimeline prefix={target.prefix} query={target.query} header={header} />
            ) : (
                <QueryTimeline prefix={target.prefix} query={target.query} header={header} />
            )}
        </>
    )
}

interface RestrictedBodyProps {
    ccid: string
    user: User
    profileName: string
}

const RestrictedBody = (props: RestrictedBodyProps) => {
    const { t } = useTranslation('', { keyPrefix: 'web.guestProfile' })
    const theme = useTheme()
    const navigate = useNavigate()

    return (
        <div
            style={{
                display: 'flex',
                flexDirection: 'column'
            }}
        >
            <title>{`${props.user.alias ?? props.ccid} on Concrnt`}</title>
            <meta name="robots" content="noindex" />
            <div
                style={{
                    position: 'relative'
                }}
            >
                <CCWallpaper
                    style={{
                        paddingTop: theme.variant === 'classic' ? 'env(safe-area-inset-top)' : undefined,
                        height: '150px'
                    }}
                />
                <div
                    style={{
                        position: 'absolute',
                        transform: 'translateY(-50%)',
                        left: CssVar.space(2),
                        width: '100px',
                        height: '100px'
                    }}
                >
                    <Avatar
                        ccid={props.ccid}
                        style={{
                            width: `100px`,
                            height: `100px`
                        }}
                    />
                    {props.profileName !== 'main' && (
                        // サブプロフィール表示中はメインプロフィールのアバターを右下に重ね、クリックでメインへ遷移する
                        <div style={{ position: 'absolute', right: '-6px', bottom: '-6px' }}>
                            <Tooltip content={<Text>{t('mainProfile')}</Text>}>
                                <ButtonBase
                                    aria-label={t('mainProfile')}
                                    style={{
                                        padding: 0,
                                        borderRadius: '6px',
                                        border: `2px solid ${CssVar.contentBackground}`,
                                        backgroundColor: CssVar.contentBackground,
                                        display: 'block'
                                    }}
                                    onClick={() => navigate('/profile/' + props.ccid)}
                                >
                                    <Avatar
                                        ccid={props.ccid}
                                        src={props.user.profile.avatar}
                                        style={{ width: '32px', height: '32px' }}
                                    />
                                </ButtonBase>
                            </Tooltip>
                        </div>
                    )}
                </div>
            </div>
            <div
                style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: CssVar.space(2),
                    padding: `0 ${CssVar.space(2)}`,
                    marginTop: '60px'
                }}
            >
                <div>
                    <Text
                        variant="h6"
                        style={{
                            fontWeight: 'bold',
                            fontSize: '1.2rem',
                            display: 'flex',
                            alignItems: 'center',
                            gap: CssVar.space(1)
                        }}
                    >
                        {props.user.alias ?? props.ccid}
                        <MdLock />
                    </Text>
                </div>
                <div>
                    <Text variant="caption">{props.ccid}</Text>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: CssVar.space(0.5) }}>
                    <MdDns size={14} style={{ opacity: 0.7 }} />
                    <Text variant="caption">{props.user.domain}</Text>
                </div>
            </div>
            <div
                style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: CssVar.space(2),
                    padding: CssVar.space(4)
                }}
            >
                <MdLock size={48} style={{ opacity: 0.5 }} />
                <Text>{t('privateProfile')}</Text>
                <Text variant="caption">{t('loginRequired')}</Text>
                <Button onClick={() => navigate('/login')}>{t('login')}</Button>
            </div>
        </div>
    )
}
