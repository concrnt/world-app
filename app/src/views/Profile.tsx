import { useMemo, useState } from 'react'
import { Avatar, CCWallpaper, IconButton, Text, View, Button, Tabs, Tab, Divider, useTheme } from '@concrnt/ui'
import { useClient } from '../contexts/Client'

import { MdSearch } from 'react-icons/md'
import { MdMoreHoriz } from 'react-icons/md'
import { MdEdit } from 'react-icons/md'
import { ProfileEditor } from '../components/ProfileEditor'
import { useDrawer } from '../contexts/Drawer'
import { useNavigation } from '../contexts/Navigation'
import { QueryTimeline } from '../components/QueryTimeline'
import { Schemas, semantics } from '@concrnt/worldlib'
import { CssVar } from '../types/Theme'
import { AcknowledgeButton } from '../components/AcknowledgeButton'
import { AcknowledgeList } from '../components/AcknowledgeList'
import { TextLoader } from '../components/TextLoader'

interface Props {
    id: string
}

export const ProfileView = (props: Props) => {
    const theme = useTheme()

    const navigation = useNavigation()
    const { client } = useClient()

    const drawer = useDrawer()

    const profilePromise = useMemo(() => {
        return client!.getUser(props.id).catch(() => null)
    }, [client, props.id])

    const isMe = useMemo(() => {
        return client?.ccid === props.id
    }, [client, props.id])

    const [updateStats, setUpdateStats] = useState(0)
    const statsPromise = useMemo(() => {
        return profilePromise.then((user) => {
            if (!user) return { acknowledging: 0, acknowledged: 0 }
            return user.GetStats(client!)
        })
    }, [client, profilePromise, updateStats])

    const [tab, setTab] = useState<'posts' | 'media' | 'activity'>('posts')

    const target = useMemo(() => {
        switch (tab ?? '') {
            case 'posts':
                return {
                    prefix: semantics.homeTimeline(props.id),
                    query: {}
                }
            case 'media':
                return {
                    prefix: semantics.homeTimeline(props.id),
                    query: {
                        schema: Schemas.mediaMessage
                    }
                }
            case 'activity':
                return {
                    prefix: semantics.activityTimeline(props.id),
                    query: {}
                }
        }
    }, [props.id, tab])

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
                                src={profilePromise.then((user) => user?.profile?.banner)}
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
                                    <IconButton variant="contained">
                                        <MdSearch size={24} />
                                    </IconButton>
                                    <IconButton variant="contained">
                                        <MdMoreHoriz size={24} />
                                    </IconButton>
                                </div>
                            </CCWallpaper>
                            <Avatar
                                ccid={props.id}
                                style={{
                                    width: `100px`,
                                    height: `100px`,
                                    position: 'absolute',
                                    transform: 'translateY(-50%)',
                                    left: CssVar.space(2)
                                }}
                                src={profilePromise.then((user) => user?.profile.avatar)}
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
                                        onClick={() => drawer.open(<ProfileEditor onComplete={() => drawer.close()} />)}
                                    >
                                        Edit Profile
                                    </Button>
                                ) : (
                                    <AcknowledgeButton ccid={props.id} onChange={() => setUpdateStats((s) => s + 1)} />
                                )}
                            </div>
                            <div>
                                <TextLoader
                                    variant="h6"
                                    style={{
                                        fontWeight: 'bold',
                                        fontSize: '1.2rem'
                                    }}
                                >
                                    {profilePromise.then((user) => user?.profile?.username || 'Anonymous')}
                                </TextLoader>
                                <TextLoader>
                                    {profilePromise.then((user) => (user?.alias ? user.alias : null))}
                                </TextLoader>
                            </div>
                            <div>
                                <Text variant="caption">{props.id}</Text>
                            </div>
                            <div>
                                <TextLoader>
                                    {profilePromise.then(
                                        (user) => user?.profile?.description || '説明はまだありません'
                                    )}
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
                                            <AcknowledgeList targetCcid={props.id} initialTab="acknowledging" />
                                        )
                                    }
                                >
                                    <TextLoader>{statsPromise.then((s) => `${s.acknowledging} フォロー`)}</TextLoader>
                                </div>
                                <div
                                    style={{ cursor: 'pointer' }}
                                    onClick={() =>
                                        drawer.open(
                                            <AcknowledgeList targetCcid={props.id} initialTab="acknowledgers" />
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
