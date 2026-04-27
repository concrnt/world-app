import { useMemo, useState } from 'react'
import { Avatar, CCWallpaper, IconButton, Text, View, Button, Tabs, Tab, Divider, useTheme } from '@concrnt/ui'
import { useClient } from '../contexts/Client'

// import { MdSearch } from 'react-icons/md'
import { MdMoreHoriz } from 'react-icons/md'
import { MdEdit } from 'react-icons/md'
import { ProfileEditor } from '../components/ProfileEditor'
import { useDrawer } from '../contexts/Drawer'
import { useNavigation } from '../contexts/Navigation'
import { QueryTimeline } from '../components/QueryTimeline'
import { ProfileSchema, Schemas, semantics } from '@concrnt/worldlib'
import { CssVar } from '../types/Theme'
import { AcknowledgeButton } from '../components/AcknowledgeButton'
import { AcknowledgeList } from '../components/AcknowledgeList'
import { TextLoader } from '../components/TextLoader'
import { useSelect } from '../contexts/Select'
import { useConfirm } from '../contexts/Confirm'

interface Props {
    ccid: string
    profileName?: string
}

export const ProfileView = (props: Props) => {
    const theme = useTheme()

    const navigation = useNavigation()
    const { client } = useClient()

    const { select } = useSelect()
    const drawer = useDrawer()
    const confirm = useConfirm()

    const [_updateBlock, setUpdateBlock] = useState(0)
    const isBlocking = client?.blocks?.includes(props.ccid)

    const userPromise = useMemo(() => {
        return client!.getUser(props.ccid).catch(() => null)
    }, [client, props.ccid])

    const profilePromise = useMemo(() => {
        return client!.api
            .getDocument<ProfileSchema>(semantics.profile(props.ccid, props.profileName ?? 'main'))
            .catch(() => {
                return {
                    key: semantics.profile(props.ccid, props.profileName ?? 'main'),
                    schema: Schemas.profile,
                    value: {
                        username: 'Anonymous',
                        description: '',
                        avatar: '',
                        banner: ''
                    }
                }
            })
    }, [client, props.ccid, props.profileName])

    const isMe = useMemo(() => {
        return client?.ccid === props.ccid
    }, [client, props.ccid])

    const [updateStats, setUpdateStats] = useState(0)
    const statsPromise = useMemo(() => {
        return userPromise.then((user) => {
            if (!user) return { acknowledging: 0, acknowledged: 0 }
            return user.GetStats(client!)
        })
    }, [client, userPromise, updateStats])

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

    return (
        <View>
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
                                src={profilePromise.then((p) => p.value.banner)}
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
                                    <IconButton
                                        variant="contained"
                                        onClick={() => {
                                            const options: Record<string, React.ReactNode> = {}
                                            if (!isMe) {
                                                if (isBlocking) {
                                                    options['unblock'] = <Text>ブロック解除</Text>
                                                } else {
                                                    options['block'] = <Text>ブロック</Text>
                                                }
                                            }

                                            select('', options, (key) => {
                                                switch (key) {
                                                    case 'block': {
                                                        confirm.open(
                                                            '本当にこのユーザーをブロックしますか？',
                                                            () => {
                                                                client?.block(props.ccid).then(() => {
                                                                    setUpdateBlock((b) => b + 1)
                                                                })
                                                            },
                                                            {
                                                                description:
                                                                    'ブロックすると、このユーザーはあなたに対しリプライを送ったり、リアクションをつけたりすることが出来なくなりますが、一般公開の投稿は引き続き見ることができます。',
                                                                confirmText: 'ブロック'
                                                            }
                                                        )
                                                        break
                                                    }
                                                    case 'unblock': {
                                                        confirm.open(
                                                            '本当にこのユーザーのブロックを解除しますか？',
                                                            () => {
                                                                client?.unblock(props.ccid).then(() => {
                                                                    setUpdateBlock((b) => b + 1)
                                                                })
                                                            },
                                                            {
                                                                description:
                                                                    'ブロックを解除すると、このユーザーはあなたに対しリプライを送ったり、リアクションをつけたりすることが出来るようになります。',
                                                                confirmText: 'ブロック解除'
                                                            }
                                                        )
                                                        break
                                                    }
                                                }
                                            })
                                        }}
                                    >
                                        <MdMoreHoriz size={24} />
                                    </IconButton>
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
                                src={profilePromise.then((p) => p.value.avatar)}
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
                                                    targetURI={semantics.profile(
                                                        props.ccid,
                                                        props.profileName ?? 'main'
                                                    )}
                                                    onComplete={() => drawer.close()}
                                                />
                                            )
                                        }
                                    >
                                        Edit Profile
                                    </Button>
                                ) : (
                                    <AcknowledgeButton
                                        ccid={props.ccid}
                                        onChange={() => setUpdateStats((s) => s + 1)}
                                    />
                                )}
                            </div>
                            <div>
                                <TextLoader
                                    variant="h6"
                                    style={{
                                        fontWeight: 'bold',
                                        fontSize: '1.2rem',
                                        textDecoration: isBlocking ? 'line-through' : undefined
                                    }}
                                >
                                    {profilePromise.then((p) => p.value.username || 'Anonymous')}
                                </TextLoader>
                                <TextLoader>{userPromise.then((user) => (user?.alias ? user.alias : null))}</TextLoader>
                            </div>
                            <div>
                                <Text variant="caption">{props.ccid}</Text>
                            </div>
                            <div>
                                <TextLoader>
                                    {profilePromise.then((p) => p.value.description || '説明はまだありません')}
                                </TextLoader>
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
                                        drawer.open(
                                            <AcknowledgeList targetCcid={props.ccid} initialTab="acknowledging" />
                                        )
                                    }
                                >
                                    <TextLoader>{statsPromise.then((s) => `${s.acknowledging} フォロー`)}</TextLoader>
                                </div>
                                <div
                                    style={{ cursor: 'pointer' }}
                                    onClick={() =>
                                        drawer.open(
                                            <AcknowledgeList targetCcid={props.ccid} initialTab="acknowledgers" />
                                        )
                                    }
                                >
                                    <TextLoader>{statsPromise.then((s) => `${s.acknowledged} フォロワー`)}</TextLoader>
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
        </View>
    )
}
