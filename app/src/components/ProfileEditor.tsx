import { useRef, useState } from 'react'
import { Avatar, Button, CCWallpaper, Text, TextField } from '@concrnt/ui'
import { useClient } from '../contexts/Client'
import { CssVar } from '../types/Theme'
import { uploadImage } from '../utils/uploadImage'

interface Props {
    onComplete?: () => void
}

export const ProfileEditor = (props: Props) => {
    const { client } = useClient()

    const [username, setUsername] = useState<string>(client?.user?.profile?.username || '')
    const [description, setDescription] = useState<string>(client?.user?.profile?.description || '')

    const [avatar, setAvatar] = useState<string>(client?.user?.profile?.avatar || '')
    const [banner, setBanner] = useState<string>(client?.user?.profile?.banner || '')

    const [avatarDraft, setAvatarDraft] = useState<File | null>(null)
    const [bannerDraft, setBannerDraft] = useState<File | null>(null)

    const avatarInputRef = useRef<HTMLInputElement>(null)
    const bannerInputRef = useRef<HTMLInputElement>(null)

    const [saving, setSaving] = useState<boolean>(false)

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
                    disabled={saving}
                    onClick={async () => {
                        if (!client) return
                        setSaving(true)
                        const document = {
                            key: `cckv://${client.ccid}/concrnt.world/main/profile`,
                            schema: 'https://schema.concrnt.world/p/main.json',
                            value: {
                                username: username,
                                description: description,
                                avatar: client?.user?.profile?.avatar,
                                banner: client?.user?.profile?.banner
                            },
                            author: client.ccid,
                            createdAt: new Date()
                        }

                        if (avatarDraft) {
                            const avatarUrl = await uploadImage(client, avatarDraft)
                            document.value.avatar = avatarUrl
                        }

                        if (bannerDraft) {
                            const bannerUrl = await uploadImage(client, bannerDraft)
                            document.value.banner = bannerUrl
                        }

                        client.api.commit(document).then(() => {
                            console.log('Profile updated')
                            props.onComplete?.()
                        })
                    }}
                >
                    {saving ? '保存中...' : '保存'}
                </Button>
            </div>

            <CCWallpaper
                src={banner}
                style={{
                    height: `150px`
                }}
                onClick={() => bannerInputRef.current?.click()}
            />
            <Avatar ccid={client?.ccid || ''} src={avatar} onClick={() => avatarInputRef.current?.click()} />
            <TextField placeholder="Username" value={username} onChange={(e) => setUsername(e.target.value)} />
            <TextField placeholder="Description" value={description} onChange={(e) => setDescription(e.target.value)} />

            <input
                hidden
                ref={avatarInputRef}
                type="file"
                accept="image/*"
                onChange={(e) => {
                    if (e.target.files?.[0]) {
                        const file = e.target.files[0]
                        setAvatarDraft(file)
                        const reader = new FileReader()
                        reader.onload = (event) => {
                            setAvatar(event.target?.result as string)
                        }
                        reader.readAsDataURL(file)
                    }
                }}
            />

            <input
                hidden
                ref={bannerInputRef}
                type="file"
                accept="image/*"
                onChange={(e) => {
                    if (e.target.files?.[0]) {
                        const file = e.target.files[0]
                        setBannerDraft(file)
                        const reader = new FileReader()
                        reader.onload = (event) => {
                            setBanner(event.target?.result as string)
                        }
                        reader.readAsDataURL(file)
                    }
                }}
            />
        </div>
    )
}
