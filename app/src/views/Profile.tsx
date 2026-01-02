import { use, useMemo } from 'react'
import { useStack } from '../layouts/Stack'
import { Avatar } from '../ui/Avatar'
import { CCWallpaper } from '../ui/CCWallpaper'
// import { Header } from '../ui/Header'
import { IconButton } from '../ui/IconButton'
import { Text } from '../ui/Text'
import { View } from '../ui/View'
import { Button } from '../ui/Button'
import { useClient } from '../contexts/Client'

import { MdArrowBack } from 'react-icons/md'
import { MdSearch } from 'react-icons/md'
import { MdMoreHoriz } from 'react-icons/md'
import { MdEdit } from 'react-icons/md'

interface Props {
    id: string
}

export const ProfileView = (props: Props) => {
    const { pop } = useStack()
    const { client } = useClient()

    const profilePromise = useMemo(() => {
        return client!.getUser(props.id)
    }, [client, props.id])
    const user = use(profilePromise)

    const isMe = useMemo(() => {
        return client?.ccid === props.id
    }, [client, props.id])

    return (
        <View>
            <div
                style={{
                    position: 'relative'
                }}
            >
                <CCWallpaper
                    style={{
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
                            padding: '0 4px',
                            gap: '4px'
                        }}
                    >
                        <IconButton
                            variant="contained"
                            onClick={() => {
                                pop()
                            }}
                        >
                            <MdArrowBack size={24} />
                        </IconButton>
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
                        left: '8px'
                    }}
                    src={user?.profile.avatar}
                />
            </div>
            <div
                style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px',
                    padding: '0 8px'
                }}
            >
                <div
                    style={{
                        height: '40px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'flex-end'
                    }}
                >
                    {isMe ? (
                        <Button variant="outlined" startIcon={<MdEdit size={20} />}>
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
                        {user?.profile.username}
                    </Text>
                    {user?.alias && <Text>@{user?.alias}</Text>}
                </div>
                <div>
                    <Text>{user?.profile.description || '説明はまだありません'}</Text>
                </div>
            </div>
        </View>
    )
}
