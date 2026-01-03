import { useState } from 'react'
import { Text } from '../ui/Text'
import { TextField } from '../ui/TextField'
import { Button } from '../ui/Button'
import { useClient } from '../contexts/Client'
import { View } from '../ui/View'
import { Header } from '../ui/Header'
import { MdMenu } from 'react-icons/md'
import { useSidebar } from '../layouts/Sidebar'

export const SettingsView = () => {
    const { client, logout } = useClient()

    const [username, setUsername] = useState('')
    const [avatar, setAvatar] = useState('')

    const { open } = useSidebar()

    return (
        <View>
            <Header
                left={
                    <div
                        style={{
                            width: '100%',
                            height: '100%',
                            display: 'flex',
                            justifyContent: 'center',
                            alignItems: 'center'
                        }}
                        onClick={() => open()}
                    >
                        <MdMenu size={24} />
                    </div>
                }
            >
                Settings
            </Header>
            <div
                style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px',
                    padding: '0 8px'
                }}
            >
                <Text>Profile</Text>
                <TextField placeholder="Username" value={username} onChange={(e) => setUsername(e.target.value)} />
                <TextField placeholder="Avatar URL" value={avatar} onChange={(e) => setAvatar(e.target.value)} />
                <Button
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
                        })
                    }}
                >
                    Save
                </Button>
                <Button
                    onClick={() => {
                        logout()
                    }}
                >
                    Logout
                </Button>
            </div>
        </View>
    )
}
