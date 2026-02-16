import { useMemo, useState } from 'react'
import { Avatar } from '../ui/Avatar'
import { CCWallpaper } from '../ui/CCWallpaper'
import { IconButton } from '../ui/IconButton'
import { Text } from '../ui/Text'
import { View } from '../ui/View'
import { Button } from '../ui/Button'
import { useClient } from '../contexts/Client'

import { MdSearch } from 'react-icons/md'
import { MdMoreHoriz } from 'react-icons/md'
import { MdEdit } from 'react-icons/md'
import { ProfileEditor } from '../components/ProfileEditor'
import { TabLayout } from '../layouts/Tab'
import { useTheme } from '../contexts/Theme'
import { useDrawer } from '../contexts/Drawer'
import { useNavigation } from '../contexts/Navigation'
import { QueryTimeline } from '../components/QueryTimeline'
import { Schemas } from '@concrnt/worldlib'

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

    const [selectedTab, setSelectedTab] = useState<string>('posts')

    const tabs = useMemo(() => {
        return {
            posts: {
                tab: <div>カレント</div>,
                body: <QueryTimeline prefix={`cckv://${props.id}/concrnt.world/main/home-timeline/`} />
            },
            media: {
                tab: <div>メディア</div>,
                body: (
                    <QueryTimeline
                        prefix={`cckv://${props.id}/concrnt.world/main/home-timeline/`}
                        query={{
                            schema: Schemas.mediaMessage
                        }}
                    />
                )
            },
            activity: {
                tab: <div>アクティビティ</div>,
                body: <QueryTimeline prefix={`cckv://${props.id}/concrnt.world/main/activity-timeline/`} />
            }
        }
    }, [])

    return (
        <>
            <View>
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
                                height: '50px',
                                padding: '0 var(--space-1)',
                                gap: 'var(--space-1)'
                            }}
                        >
                            <div
                                style={{
                                    color: theme.variant === 'classic' ? theme.backdrop.text : theme.ui.text,
                                    height: 'var(--control-header)',
                                    width: 'var(--control-header)'
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
                            <div></div>
                        </div>
                    </CCWallpaper>
                    <Avatar
                        ccid={props.id}
                        style={{
                            width: '100px',
                            height: '100px',
                            position: 'absolute',
                            transform: 'translateY(-50%)',
                            left: 'var(--space-2)'
                        }}
                        src={profilePromise.then((user) => user?.profile.avatar)}
                    />
                </div>
                <div
                    style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 'var(--space-1)',
                        padding: '0 var(--space-2)'
                    }}
                >
                    <div
                        style={{
                            height: 'var(--control-header)',
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
                            <Button>Follow</Button>
                        )}
                    </div>
                    <div>
                        <Text
                            variant="h6"
                            style={{
                                fontWeight: 'bold',
                                fontSize: '1.2rem'
                            }}
                        >
                            {profilePromise.then((user) => user?.profile?.username || 'Anonymous')}
                        </Text>
                        <Text>{profilePromise.then((user) => (user?.alias ? user.alias : null))}</Text>
                    </div>
                    <div>
                        <Text variant="caption">{props.id}</Text>
                    </div>
                    <div>
                        <Text>
                            {profilePromise.then((user) => user?.profile?.description || '説明はまだありません')}
                        </Text>
                    </div>
                </div>
                <TabLayout
                    divider
                    tabs={tabs}
                    selectedTab={selectedTab}
                    setSelectedTab={(tab) => setSelectedTab(tab)}
                    placement="upper"
                    tabStyle={{
                        color: theme.content.text
                    }}
                />
            </View>
        </>
    )
}
