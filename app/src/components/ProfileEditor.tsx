import { useEffect, useRef, useState } from 'react'
import { Document } from '@concrnt/client'
import { Avatar, Button, CCWallpaper, Checkbox, Text, TextField } from '@concrnt/ui'
import { useClient } from '../contexts/Client'
import { CssVar } from '../types/Theme'
import { uploadImage } from '../utils/uploadImage'
import { useImageCropper } from '../contexts/ImageCropper'
import { ProfileSchema } from '@concrnt/worldlib'
import { UserPicker } from './UserPicker'

interface Props {
    onComplete?: () => void
    targetURI: string
    title?: string
    noLoading?: boolean
}

export const ProfileEditor = (props: Props) => {
    const { client } = useClient()
    const cropper = useImageCropper()

    const [loading, setLoading] = useState<boolean>(!!props.noLoading)

    const [username, setUsername] = useState<string>('')
    const [description, setDescription] = useState<string>('')

    const [avatar, setAvatar] = useState<string>('')
    const [banner, setBanner] = useState<string>('')

    const [avatarDraft, setAvatarDraft] = useState<File | null>(null)
    const [bannerDraft, setBannerDraft] = useState<File | null>(null)

    const [restricted, setRestricted] = useState<boolean>(false)
    const [members, setMembers] = useState<string[]>([])

    const avatarInputRef = useRef<HTMLInputElement>(null)
    const bannerInputRef = useRef<HTMLInputElement>(null)

    const [saving, setSaving] = useState<boolean>(false)

    useEffect(() => {
        if (props.noLoading) return
        client.api
            .getDocument<ProfileSchema>(props.targetURI)
            .then((doc) => {
                if (doc) {
                    setUsername(doc.value.username ?? '')
                    setDescription(doc.value.description ?? '')
                    setAvatar(doc.value.avatar ?? '')
                    setBanner(doc.value.banner ?? '')

                    if (doc.policy?.entries?.length == 1) {
                        const policy = doc.policy.entries[0]
                        if (policy.url === 'https://policy.concrnt.world/t/restrict-readers.json') {
                            setRestricted(true)
                            setMembers(policy.params.entities ?? [])
                        } else {
                            setRestricted(false)
                            setMembers([])
                        }
                    } else {
                        setRestricted(false)
                        setMembers([])
                    }
                }
            })
            .finally(() => {
                setLoading(false)
            })
    }, [client, props.targetURI])

    if (loading) {
        return <div>最新のプロフィールを読み込んでいます...</div>
    }

    return (
        <div
            style={{
                display: 'flex',
                flexDirection: 'column',
                gap: CssVar.space(4),
                width: '100%'
            }}
        >
            <div
                style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                }}
            >
                <Text variant="h3">{props.title ?? 'Profile'}</Text>
                <Button
                    disabled={saving}
                    onClick={async () => {
                        if (!client) return
                        setSaving(true)
                        const document: Document<ProfileSchema> = {
                            key: props.targetURI,
                            schema: 'https://schema.concrnt.world/p/main.json',
                            value: {
                                username: username,
                                description: description,
                                avatar: avatar,
                                banner: banner
                            },
                            author: client.ccid,
                            createdAt: new Date()
                        }

                        if (restricted) {
                            document.policy = {
                                entries: [
                                    {
                                        url: 'https://policy.concrnt.world/t/restrict-readers.json',
                                        params: {
                                            entities: members
                                        },
                                        defaults: {
                                            'record:read': 'no'
                                        }
                                    }
                                ]
                            }
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
                            client.updateProfiles()
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

            <div
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between'
                }}
            >
                <Text>アカウントを非公開にする</Text>
                <Checkbox
                    checked={restricted}
                    onChange={(c) => {
                        setRestricted(c)
                    }}
                />
            </div>
            {restricted && (
                <>
                    <Text>閲覧可能ユーザーを選択</Text>
                    <Text variant="caption">
                        ユーザーを選択するには、まずそのユーザーをフォローする必要があります。
                    </Text>
                    <UserPicker selected={members} setSelected={setMembers} />
                </>
            )}

            <input
                hidden
                ref={avatarInputRef}
                type="file"
                accept="image/*"
                onChange={async (e) => {
                    if (e.target.files?.[0]) {
                        const file = e.target.files[0]
                        const reader = new FileReader()
                        reader.onload = async (event) => {
                            const src = event.target?.result as string
                            const croppedFile = await cropper.open(src, {
                                aspect: 1,
                                outputWidth: 512
                            })
                            if (croppedFile) {
                                setAvatarDraft(croppedFile)
                                setAvatar(URL.createObjectURL(croppedFile))
                            }
                        }
                        reader.readAsDataURL(file)
                        // 同じファイルを再選択できるようにリセット
                        if (avatarInputRef.current) {
                            avatarInputRef.current.value = ''
                        }
                    }
                }}
            />

            <input
                hidden
                ref={bannerInputRef}
                type="file"
                accept="image/*"
                onChange={async (e) => {
                    if (e.target.files?.[0]) {
                        const file = e.target.files[0]
                        const reader = new FileReader()
                        reader.onload = async (event) => {
                            const src = event.target?.result as string
                            const croppedFile = await cropper.open(src, {
                                aspect: 3,
                                outputWidth: 1500,
                                outputHeight: 500
                            })
                            if (croppedFile) {
                                setBannerDraft(croppedFile)
                                setBanner(URL.createObjectURL(croppedFile))
                            }
                        }
                        reader.readAsDataURL(file)
                        // 同じファイルを再選択できるようにリセット
                        if (bannerInputRef.current) {
                            bannerInputRef.current.value = ''
                        }
                    }
                }}
            />
        </div>
    )
}
