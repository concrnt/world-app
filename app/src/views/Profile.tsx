import { ReactNode, startTransition, Suspense, use, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
    Avatar,
    CCWallpaper,
    Confirm,
    IconButton,
    Select,
    Text,
    View,
    Button,
    Tabs,
    Tab,
    Divider,
    useTheme,
    ListItem
} from '@concrnt/ui'
import { useClient } from '../contexts/Client'

// import { MdSearch } from 'react-icons/md'
import { MdMoreHoriz } from 'react-icons/md'
import { MdEdit } from 'react-icons/md'
import { ProfileEditor } from '../components/ProfileEditor'
import { Drawer } from '../ui/Drawer'
import { useNavigation } from '../contexts/Navigation'
import { QueryTimeline } from '../components/QueryTimeline'
import { Document, PermissionError } from '@concrnt/client'
import { ProfileSchema, Schemas, semantics, User } from '@concrnt/worldlib'
import { CssVar } from '../types/Theme'
import { AcknowledgeButton } from '../components/AcknowledgeButton'
import { AcknowledgeListView } from './AcknowledgeList'
import { useStack } from '../layouts/Stack'
import { shareText } from '../lib/share'
import { useSubscribe } from '../hooks/useSubscribe'
import { ProfileName } from '../components/ProfileName'
import { PrivateContentDoor } from '../components/PrivateContentDoor'
import { MdLock, MdDns } from 'react-icons/md'
import { useMediaViewer } from '../contexts/MediaViewer'
import { useMediaProxy } from '../contexts/MediaProxy'

interface Props {
    ccid: string
    profileName?: string
}

// useSubscribeはsuspendするので単独コンポーネントに分離し、利用側で<Suspense fallback={null}>に包む
const FollowedBadge = (props: { ccid: string }) => {
    const { t } = useTranslation('', { keyPrefix: 'views.profile' })
    const { client } = useClient()
    const [acknowledgers] = useSubscribe(client.acknowledgers)
    const followed = acknowledgers.some((a) => a.author === props.ccid)
    if (!followed) return null
    return (
        <Text
            variant="caption"
            style={{
                fontSize: '0.65rem',
                opacity: 0.6,
                fontWeight: 'normal',
                flexShrink: 0,
                border: `1px solid ${CssVar.divider}`,
                borderRadius: CssVar.round(0.5),
                padding: `1px ${CssVar.space(1)}`,
                whiteSpace: 'nowrap'
            }}
        >
            {t('followsYou')}
        </Text>
    )
}

export const ProfileView = (props: Props) => {
    const { client } = useClient()

    const userPromise = useMemo(() => {
        return client.getUser(props.ccid).catch(() => null)
    }, [client, props.ccid])

    const profileKey = semantics.profile(props.ccid, props.profileName ?? 'main')

    // 表示はキャッシュ即出し(profilePromise)のまま、裏で最新を取得して置き換える(SWR)。
    // no-cacheの結果はKVSにも書き戻されるので次回表示の即出しキャッシュも最新化される
    const [freshProfile, setFreshProfile] = useState<Document<ProfileSchema> | null>(null)
    const [prevProfileKey, setPrevProfileKey] = useState(profileKey)
    if (prevProfileKey !== profileKey) {
        setPrevProfileKey(profileKey)
        setFreshProfile(null)
    }

    const [reload, setReload] = useState(0)

    useEffect(() => {
        client.api
            .getDocument<ProfileSchema>(profileKey, undefined, { cache: 'no-cache' })
            .then((doc) => setFreshProfile(doc))
            .catch(() => {
                // 権限エラー/404等はキャッシュ由来の表示(restricted/Anonymous)を維持する
            })
    }, [client, profileKey, reload])

    const profilePromise = useMemo<Promise<Document<ProfileSchema> | 'restricted'>>(() => {
        return client.api
            .getDocument<ProfileSchema>(semantics.profile(props.ccid, props.profileName ?? 'main'))
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
    }, [client, props.ccid, props.profileName, reload])

    return (
        <View>
            <Suspense>
                <Inner
                    ccid={props.ccid}
                    userPromise={userPromise}
                    profilePromise={profilePromise}
                    freshProfile={freshProfile}
                    profileName={props.profileName ?? 'main'}
                    reload={() => {
                        setReload((prev) => prev + 1)
                    }}
                />
            </Suspense>
        </View>
    )
}

interface InnerProps {
    ccid: string
    userPromise: Promise<User | null>
    profilePromise: Promise<Document<ProfileSchema> | 'restricted'>
    freshProfile: Document<ProfileSchema> | null
    profileName: string
    reload: () => void
}

const Inner = (props: InnerProps) => {
    const { t } = useTranslation('', { keyPrefix: 'views.profile' })
    const user = use(props.userPromise)
    // use()は条件付き呼び出しが許可されている。fresh値が届いたらキャッシュ側は読まない
    const profile = props.freshProfile ?? use(props.profilePromise)

    if (user === null) {
        return <Text>{t('userNotFound')}</Text>
    }

    if (profile === 'restricted') {
        return <RestrictedBody ccid={props.ccid} user={user} profileName={props.profileName} />
    }

    return (
        <Body ccid={props.ccid} user={user} profile={profile} profileName={props.profileName} reload={props.reload} />
    )
}

interface BodyProps {
    ccid: string
    user: User
    profile: Document<ProfileSchema>
    profileName: string
    reload: () => void
}

const Body = (props: BodyProps) => {
    const { getImageURL } = useMediaProxy()
    const { t } = useTranslation('', { keyPrefix: 'views.profile' })
    const [stats, reloadStats] = useSubscribe(props.user.stats)
    const profile = props.profile

    const { client } = useClient()
    const theme = useTheme()

    const navigation = useNavigation()
    const mediaViewer = useMediaViewer()
    const stack = useStack()

    const isMe = client.ccid === props.ccid

    const [blocks] = useSubscribe(client.blocks)
    const isBlocking = blocks.includes(props.ccid)

    const [tab, setTab] = useState<'posts' | 'media' | 'activity'>('posts')

    const [menuOpen, setMenuOpen] = useState(false)
    const [blockConfirmOpen, setBlockConfirmOpen] = useState(false)
    const [unblockConfirmOpen, setUnblockConfirmOpen] = useState(false)
    const [profileEditorOpen, setProfileEditorOpen] = useState(false)

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

    // シェア用URLはデプロイ先ホストに関わらずconcrnt.world固定(OGP対応がconcrnt.worldのみのため)
    const shareURL =
        'https://concrnt.world/profile/' + props.ccid + (props.profileName !== 'main' ? '/' + props.profileName : '')

    const selectOptions = useMemo(() => {
        const options: ReactNode[] = []
        options.push(
            <ListItem
                key="share"
                onClick={() => {
                    shareText(shareURL, profile.value.username ?? props.ccid).catch(() => {})
                    setMenuOpen(false)
                }}
            >
                <Text>{t('share')}</Text>
            </ListItem>
        )
        if (!isMe) {
            if (isBlocking) {
                options.push(
                    <ListItem
                        key="unblock"
                        onClick={() => {
                            setUnblockConfirmOpen(true)
                        }}
                    >
                        <Text>{t('unblock')}</Text>
                    </ListItem>
                )
            } else {
                options.push(
                    <ListItem
                        key="block"
                        onClick={() => {
                            setBlockConfirmOpen(true)
                        }}
                    >
                        <Text>{t('block')}</Text>
                    </ListItem>
                )
            }
        }
        return options
    }, [isBlocking, isMe, t, shareURL, profile.value.username, props.ccid])

    return (
        <>
            <QueryTimeline
                prefix={target.prefix}
                query={target.query}
                header={
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
                            >
                                <div
                                    style={{
                                        width: '100%',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                        padding: CssVar.space(1),
                                        gap: CssVar.space(1)
                                    }}
                                >
                                    <div
                                        style={{
                                            color: theme.variant === 'classic' ? CssVar.backdropText : CssVar.uiText,
                                            height: '40px',
                                            width: '40px'
                                        }}
                                    >
                                        {navigation.backNode}
                                    </div>
                                    <div style={{ flex: 1 }} />
                                    {/*
                                    <IconButton variant="contained">
                                        <MdSearch size={24} />
                                    </IconButton>
                                    */}
                                    {selectOptions.length > 0 && (
                                        <IconButton
                                            variant="contained"
                                            onClick={() => {
                                                setMenuOpen(true)
                                            }}
                                        >
                                            <MdMoreHoriz size={24} />
                                        </IconButton>
                                    )}
                                </div>
                            </CCWallpaper>
                            <Avatar
                                ccid={props.ccid}
                                style={{
                                    width: `100px`,
                                    height: `100px`,
                                    position: 'absolute',
                                    transform: 'translateY(-50%)',
                                    left: CssVar.space(2),
                                    cursor: profile.value.avatar ? 'pointer' : undefined
                                }}
                                src={profile.value.avatar}
                                onClick={() => {
                                    const avatar = profile.value.avatar
                                    if (!avatar) return
                                    mediaViewer.open([{ mediaURL: avatar, mediaType: 'image/*' }])
                                }}
                            />
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
                                {isMe ? (
                                    <Button
                                        variant="outlined"
                                        startIcon={<MdEdit size={20} />}
                                        onClick={() => setProfileEditorOpen(true)}
                                    >
                                        Edit Profile
                                    </Button>
                                ) : (
                                    <AcknowledgeButton
                                        ccid={props.ccid}
                                        watchTarget={semantics.homeTimeline(props.ccid, props.profileName ?? 'main')}
                                        onChange={() => {
                                            startTransition(() => {
                                                reloadStats()
                                            })
                                        }}
                                    />
                                )}
                            </div>
                            <div>
                                <Text
                                    variant="h6"
                                    style={{
                                        fontWeight: 'bold',
                                        fontSize: '1.2rem',
                                        textDecoration: isBlocking ? 'line-through' : undefined,
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: CssVar.space(1),
                                        flexWrap: 'wrap'
                                    }}
                                >
                                    <ProfileName document={profile} />
                                    {client.ccid && !isMe && (
                                        <Suspense fallback={null}>
                                            <FollowedBadge ccid={props.ccid} />
                                        </Suspense>
                                    )}
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
                            <div>
                                <Text>{profile.value.description || t('noDescription')}</Text>
                            </div>
                            <div
                                style={{
                                    display: 'flex',
                                    gap: CssVar.space(2)
                                }}
                            >
                                <div
                                    style={{ cursor: 'pointer' }}
                                    onClick={() =>
                                        stack.push(
                                            <AcknowledgeListView
                                                targetCcid={props.ccid}
                                                initialTab="acknowledging"
                                                title={profile.value.username}
                                            />
                                        )
                                    }
                                >
                                    <Text>{t('following', { n: stats.acknowledging })}</Text>
                                </div>
                                <div
                                    style={{ cursor: 'pointer' }}
                                    onClick={() =>
                                        stack.push(
                                            <AcknowledgeListView
                                                targetCcid={props.ccid}
                                                initialTab="acknowledgers"
                                                title={profile.value.username}
                                            />
                                        )
                                    }
                                >
                                    <Text>{t('followers', { n: stats.acknowledged })}</Text>
                                </div>
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
                        <Divider />
                    </>
                }
            />
            <Select open={menuOpen} onClose={() => setMenuOpen(false)} options={selectOptions} />
            <Confirm
                open={unblockConfirmOpen}
                onClose={() => setUnblockConfirmOpen(false)}
                title={t('unblockConfirmTitle')}
                onConfirm={() => {
                    client?.unblock(props.ccid)
                }}
                description={t('unblockConfirmDescription')}
                confirmText={t('unblock')}
            />
            <Confirm
                open={blockConfirmOpen}
                onClose={() => setBlockConfirmOpen(false)}
                title={t('blockConfirmTitle')}
                onConfirm={() => {
                    client?.block(props.ccid)
                }}
                description={t('blockConfirmDescription')}
                confirmText={t('block')}
            />
            <Drawer open={profileEditorOpen} onClose={() => setProfileEditorOpen(false)}>
                <ProfileEditor
                    targetURI={semantics.profile(props.ccid, props.profileName ?? 'main')}
                    onComplete={() => {
                        // TODO: useSubscribeパターンに移行する
                        props.reload()
                        client.updateProfiles()
                        setProfileEditorOpen(false)
                    }}
                />
            </Drawer>
        </>
    )
}

interface RestrictedBodyProps {
    ccid: string
    user: User
    profileName: string
}

const RestrictedBody = (props: RestrictedBodyProps) => {
    const { client } = useClient()
    const theme = useTheme()
    const navigation = useNavigation()

    const isMe = client.ccid === props.ccid

    return (
        <div
            style={{
                display: 'flex',
                flexDirection: 'column'
            }}
        >
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
                >
                    <div
                        style={{
                            width: '100%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: CssVar.space(1),
                            gap: CssVar.space(1)
                        }}
                    >
                        <div
                            style={{
                                color: theme.variant === 'classic' ? CssVar.backdropText : CssVar.uiText,
                                height: '40px',
                                width: '40px'
                            }}
                        >
                            {navigation.backNode}
                        </div>
                        <div style={{ flex: 1 }} />
                    </div>
                </CCWallpaper>
                <Avatar
                    ccid={props.ccid}
                    style={{
                        width: `100px`,
                        height: `100px`,
                        position: 'absolute',
                        transform: 'translateY(-50%)',
                        left: CssVar.space(2)
                    }}
                />
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
                    {!isMe && (
                        <AcknowledgeButton
                            ccid={props.ccid}
                            watchTarget={semantics.homeTimeline(props.ccid, props.profileName)}
                        />
                    )}
                </div>
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
                        {client.ccid && !isMe && (
                            <Suspense fallback={null}>
                                <FollowedBadge ccid={props.ccid} />
                            </Suspense>
                        )}
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
            <PrivateContentDoor
                kind="profile"
                targetUri={semantics.profile(props.ccid, props.profileName)}
                owner={props.ccid}
                notifyProfile={props.profileName}
            />
        </div>
    )
}
