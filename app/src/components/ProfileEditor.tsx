import { useState } from 'react'
import { Button } from '../ui/Button'
import { Drawer } from '../ui/Drawer'
import { Text } from '../ui/Text'
import { TextField } from '../ui/TextField'
import { useClient } from '../contexts/Client'

interface Props {
    open: boolean
    onClose: () => void
}

export const ProfileEditor = (props: Props) => {
    const { client } = useClient()

    const [avatar, setAvatar] = useState<string>(client?.user?.profile?.avatar || '')
    const [username, setUsername] = useState<string>(client?.user?.profile?.username || '')
    const [description, setDescription] = useState<string>(client?.user?.profile?.description || '')
    const [banner, setBanner] = useState<string>(client?.user?.profile?.banner || '')

    return (
        <Drawer
            open={props.open}
            onClose={props.onClose}
            style={{
                padding: '8px'
            }}
            headerRightElement={
                <Button
                    variant="text"
                    onClick={() => {
                        if (!client) return
                        const document = {
                            key: '/concrnt.world/main/profile',
                            schema: 'https://schema.concrnt.world/p/main.json',
                            value: {
                                username,
                                avatar
                            },
                            author: client.ccid,
                            createdAt: new Date()
                        }
                        client.api.commit(document).then(() => {
                            console.log('Profile updated')
                            props.onClose()
                        })
                    }}
                >
                    保存
                </Button>
            }
        >
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <Text variant="h3">Profile</Text>
                <TextField placeholder="Username" value={username} onChange={(e) => setUsername(e.target.value)} />
                <TextField placeholder="Avatar URL" value={avatar} onChange={(e) => setAvatar(e.target.value)} />
                <TextField
                    placeholder="Description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                />
                <TextField placeholder="Banner URL" value={banner} onChange={(e) => setBanner(e.target.value)} />
            </div>
        </Drawer>
    )
}
