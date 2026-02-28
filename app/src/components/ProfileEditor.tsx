import { useState } from 'react'
import { Button, Text, TextField } from '@concrnt/ui'
import { useClient } from '../contexts/Client'
import { CssVar } from '../types/Theme'

interface Props {
    onComplete?: () => void
}

export const ProfileEditor = (props: Props) => {
    const { client } = useClient()

    const [avatar, setAvatar] = useState<string>(client?.user?.profile?.avatar || '')
    const [username, setUsername] = useState<string>(client?.user?.profile?.username || '')
    const [description, setDescription] = useState<string>(client?.user?.profile?.description || '')
    const [banner, setBanner] = useState<string>(client?.user?.profile?.banner || '')

    return (
        <div
            style={{
                display: 'flex',
                flexDirection: 'column',
                gap: CssVar.space(4)
            }}
        >
            <div
                style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                }}
            >
                <Text variant="h3">Profile</Text>
                <Button
                    onClick={() => {
                        if (!client) return
                        const document = {
                            key: `cckv://${client.ccid}/concrnt.world/main/profile`,
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
                            props.onComplete?.()
                        })
                    }}
                >
                    保存
                </Button>
            </div>
            <TextField placeholder="Username" value={username} onChange={(e) => setUsername(e.target.value)} />
            <TextField placeholder="Avatar URL" value={avatar} onChange={(e) => setAvatar(e.target.value)} />
            <TextField placeholder="Description" value={description} onChange={(e) => setDescription(e.target.value)} />
            <TextField placeholder="Banner URL" value={banner} onChange={(e) => setBanner(e.target.value)} />
        </div>
    )
}
