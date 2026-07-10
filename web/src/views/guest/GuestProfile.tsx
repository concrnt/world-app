import { Suspense, use, useMemo, useState } from 'react'
import { Avatar, CCWallpaper, Text, View, Button, Tabs, Tab, Divider, useTheme } from '@concrnt/ui'
import { useClient } from '../../contexts/Client'
import { useNavigate } from 'react-router-dom'

import { QueryTimeline } from '../../components/QueryTimeline'
import { Document, PermissionError } from '@concrnt/client'
import { ProfileSchema, Schemas, semantics, User } from '@concrnt/worldlib'
import { CssVar } from '../../types/Theme'
import { useSubscribe } from '../../hooks/useSubscribe'
import { ProfileName } from '../../components/ProfileName'
import { MdLock } from 'react-icons/md'

interface Props {
    ccid: string
    profileName?: string
}

// views/Profile.tsx のゲスト(未ログイン)版。書き込みを伴うUI(編集・フォロー・ブロック等)を持たない
export const GuestProfileView = (props: Props) => {
    const { client } = useClient()

    const userPromise = useMemo(() => {
        return client.getUser(props.ccid).catch(() => null)
    }, [client, props.ccid])

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
    }, [client, props.ccid, props.profileName])

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
    const user = use(props.userPromise)
    const profile = use(props.profilePromise)

    if (user === null) {
        return <Text>ユーザーが見つかりませんでした</Text>
    }

    if (profile === 'restricted') {
        return <RestrictedBody ccid={props.ccid} user={user} />
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
    const [stats] = useSubscribe(props.user.stats)
    const profile = props.profile

    const theme = useTheme()
    const navigate = useNavigate()

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
                        />
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
                            <Button variant="outlined" onClick={() => navigate('/login')}>
                                ログインしてフォロー
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
                        <div>
                            <Text>{profile.value.description || '説明はまだありません'}</Text>
                        </div>
                        <div
                            style={{
                                display: 'flex',
                                gap: CssVar.space(2)
                            }}
                        >
                            <Text>{`${stats.acknowledging} フォロー`}</Text>
                            <Text>{`${stats.acknowledged} フォロワー`}</Text>
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

interface RestrictedBodyProps {
    ccid: string
    user: User
}

const RestrictedBody = (props: RestrictedBodyProps) => {
    const theme = useTheme()
    const navigate = useNavigate()

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
                />
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
                <Text>このプロフィールはプライベートです</Text>
                <Text variant="caption">閲覧をリクエストするにはログインが必要です</Text>
                <Button onClick={() => navigate('/login')}>ログイン</Button>
            </div>
        </div>
    )
}
