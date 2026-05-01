import { ReactNode, startTransition, Suspense, use, useMemo, useState } from 'react'
import {
    Avatar,
    CCWallpaper,
    IconButton,
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
import { useDrawer } from '../contexts/Drawer'
import { useNavigation } from '../contexts/Navigation'
import { QueryTimeline } from '../components/QueryTimeline'
import { Document } from '@concrnt/client'
import { ProfileSchema, Schemas, semantics, User } from '@concrnt/worldlib'
import { CssVar } from '../types/Theme'
import { AcknowledgeButton } from '../components/AcknowledgeButton'
import { AcknowledgeList } from '../components/AcknowledgeList'
import { useSelect } from '../contexts/Select'
import { useConfirm } from '../contexts/Confirm'
import { useSubscribe } from '../hooks/useSubscribe'

interface Props {
    ccid: string
    profileName?: string
}

export const ProfileView = (props: Props) => {
    const { client } = useClient()

    const userPromise = useMemo(() => {
        return client.getUser(props.ccid).catch(() => null)
    }, [client, props.ccid])

    const [reload, setReload] = useState(0)
    const profilePromise = useMemo(() => {
        return client.api
            .getDocument<ProfileSchema>(semantics.profile(props.ccid, props.profileName ?? 'main'))
            .catch(() => {
                const tmp: Document<ProfileSchema> = {
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
    profilePromise: Promise<Document<ProfileSchema>>
    profileName: string
    reload: () => void
}

const Inner = (props: InnerProps) => {
    const user = use(props.userPromise)

    if (user === null) {
        return <Text>ユーザーが見つかりませんでした</Text>
    }

    return (
        <Body
            ccid={props.ccid}
            user={user}
            profilePromise={props.profilePromise}
            profileName={props.profileName}
            reload={props.reload}
        />
    )
}

interface BodyProps {
    ccid: string
    user: User
    profilePromise: Promise<Document<ProfileSchema>>
    profileName: string
    reload: () => void
}

const Body = (props: BodyProps) => {
    const [stats, reloadStats] = useSubscribe(props.user.stats)
    const profile = use(props.profilePromise)

    const { client } = useClient()
    const theme = useTheme()

    const navigation = useNavigation()
    const { select } = useSelect()
    const drawer = useDrawer()

    const isMe = client.ccid === props.ccid

    const confirm = useConfirm()
    const [blocks] = useSubscribe(client.blocks)
    const isBlocking = blocks.includes(props.ccid)

    const [tab, setTab] = useState<'posts' | 'media' | 'activity'>('posts')

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

    const selectOptions = useMemo(() => {
        const options: ReactNode[] = []
        if (!isMe) {
            if (isBlocking) {
                options.push(
                    <ListItem
                        onClick={() => {
                            confirm.open(
                                '本当にこのユーザーのブロックを解除しますか？',
                                () => {
                                    client?.unblock(props.ccid)
                                },
                                {
                                    description:
                                        'ブロックを解除すると、このユーザーはあなたに対しリプライを送ったり、リアクションをつけたりすることが出来るようになります。',
                                    confirmText: 'ブロック解除'
                                }
                            )
                        }}
                    >
                        <Text>ブロック解除</Text>
                    </ListItem>
                )
            } else {
                options.push(
                    <ListItem
                        onClick={() => {
                            confirm.open(
                                '本当にこのユーザーをブロックしますか？',
                                () => {
                                    client?.block(props.ccid)
                                },
                                {
                                    description:
                                        'ブロックすると、このユーザーはあなたに対しリプライを送ったり、リアクションをつけたりすることが出来なくなりますが、一般公開の投稿は引き続き見ることができます。',
                                    confirmText: 'ブロック'
                                }
                            )
                        }}
                    >
                        <Text>ブロック</Text>
                    </ListItem>
                )
            }
        }
        return options
    }, [client, confirm, isBlocking, props.ccid, isMe])

    return (
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
                            src={profile.value.banner}
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
                                            select('', selectOptions)
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
                                left: CssVar.space(2)
                            }}
                            src={profile.value.avatar}
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
                                    onClick={() =>
                                        drawer.open(
                                            <ProfileEditor
                                                initial={profile.value}
                                                targetURI={semantics.profile(props.ccid, props.profileName ?? 'main')}
                                                onComplete={() => {
                                                    // TODO: useSubscribeパターンに移行する
                                                    props.reload()
                                                    client.updateProfiles()
                                                    drawer.close()
                                                }}
                                            />
                                        )
                                    }
                                >
                                    Edit Profile
                                </Button>
                            ) : (
                                <AcknowledgeButton
                                    ccid={props.ccid}
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
                                    textDecoration: isBlocking ? 'line-through' : undefined
                                }}
                            >
                                {profile.value.username || 'Anonymous'}
                            </Text>
                            <Text>{props.user?.alias ? props.user.alias : null}</Text>
                        </div>
                        <div>
                            <Text variant="caption">{props.ccid}</Text>
                        </div>
                        <div>
                            <Text>{profile.value.description || '説明はまだありません'}</Text>
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
                                    drawer.open(<AcknowledgeList targetCcid={props.ccid} initialTab="acknowledging" />)
                                }
                            >
                                <Text>{`${stats.acknowledging} フォロー`}</Text>
                            </div>
                            <div
                                style={{ cursor: 'pointer' }}
                                onClick={() =>
                                    drawer.open(<AcknowledgeList targetCcid={props.ccid} initialTab="acknowledgers" />)
                                }
                            >
                                <Text>{`${stats.acknowledged} フォロワー`}</Text>
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
    )
}
