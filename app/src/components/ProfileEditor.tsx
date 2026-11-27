import { Suspense, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Reorder, useDragControls } from 'motion/react'
import { MdAdd, MdClose, MdDragHandle } from 'react-icons/md'
import { Document } from '@concrnt/client'
import { Avatar, Button, IconButton, CCWallpaper, Switch, Text, TextArea, TextField } from '@concrnt/ui'
import { useClient } from '../contexts/Client'
import { CssVar } from '../types/Theme'
import { uploadImage } from '../utils/uploadImage'
import { useImageCropper } from '../contexts/ImageCropper'
import { ProfileLinksSchema, ProfileSchema, safeHttpUrl, Schemas } from '@concrnt/worldlib'
import { UserPicker } from './UserPicker'
import { useMediaProxy } from '../contexts/MediaProxy'

interface Props {
    onComplete?: () => void
    targetURI: string
    title?: string
    noLoading?: boolean
}

export const ProfileEditor = (props: Props) => {
    const { getImageURL } = useMediaProxy()
    const { t } = useTranslation('', { keyPrefix: 'components.profileEditor' })
    const { client } = useClient()
    const cropper = useImageCropper()

    const [loading, setLoading] = useState<boolean>(!props.noLoading)

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

    // id は並べ替え(Reorder)が行を追跡するためだけのもので、保存しない
    const [links, setLinks] = useState<{ id: string; url: string }[]>([])
    const [linksExisted, setLinksExisted] = useState<boolean>(false)

    const [saving, setSaving] = useState<boolean>(false)

    useEffect(() => {
        if (props.noLoading) return
        const loadLinks = client.api.getDocument<ProfileLinksSchema>(props.targetURI + '/links').then((doc) => {
            setLinks(doc.value.links.map((link) => ({ id: crypto.randomUUID(), url: link.url })))
            setLinksExisted(true)
        })
        const loadProfile = client.api.getDocument<ProfileSchema>(props.targetURI).then((doc) => {
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
        Promise.allSettled([loadProfile, loadLinks]).then(() => setLoading(false))
    }, [client, props.targetURI])

    if (loading) {
        return <div>{t('loadingProfile')}</div>
    }

    return (
        <div
            style={{
                display: 'flex',
                flexDirection: 'column',
                gap: CssVar.space(2),
                width: '100%'
            }}
        >
            <div
                style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: `0 ${CssVar.space(2)}`
                }}
            >
                <Text variant="h3">{props.title ?? 'Profile'}</Text>
                <Button
                    disabled={saving || links.some((link) => !safeHttpUrl(link.url))}
                    onClick={async () => {
                        if (!client) return
                        setSaving(true)
                        const document: Document<ProfileSchema> = {
                            kind: 'record',
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
                            const [avatarUrl] = await uploadImage(client, avatarDraft)
                            document.value.avatar = avatarUrl
                        }

                        if (bannerDraft) {
                            const [bannerUrl] = await uploadImage(client, bannerDraft)
                            document.value.banner = bannerUrl
                        }

                        await client.api.commit(document)
                        if (links.length > 0) {
                            await client.api.commit<ProfileLinksSchema>({
                                kind: 'record',
                                key: props.targetURI + '/links',
                                schema: Schemas.profileLinks,
                                value: { links: links.map((link) => ({ url: link.url })) },
                                author: client.ccid,
                                createdAt: new Date(),
                                policy: document.policy
                            })
                        } else if (linksExisted) {
                            await client.api.delete(props.targetURI + '/links')
                        }
                        console.log('Profile updated')
                        client.updateProfiles(true)
                        props.onComplete?.()
                    }}
                >
                    {saving ? t('saving') : t('save')}
                </Button>
            </div>

            <div
                style={{
                    position: 'relative',
                    paddingBottom: `calc(40px + ${CssVar.space(2)})`
                }}
            >
                <CCWallpaper
                    src={getImageURL(banner)}
                    style={{
                        height: `120px`
                    }}
                    onClick={() => bannerInputRef.current?.click()}
                />
                <Avatar
                    style={{
                        width: `80px`,
                        height: `80px`,
                        position: 'absolute',
                        transform: 'translateY(-50%)',
                        left: CssVar.space(4)
                    }}
                    ccid={client?.ccid || ''}
                    src={avatar}
                    onClick={() => avatarInputRef.current?.click()}
                />
            </div>

            <div
                style={{
                    padding: `0 ${CssVar.space(2)}`,
                    gap: CssVar.space(2),
                    display: 'flex',
                    flexDirection: 'column'
                }}
            >
                <TextField placeholder="Username" value={username} onChange={(e) => setUsername(e.target.value)} />
                <TextArea
                    placeholder="Description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                />

                <Text>{t('links')}</Text>
                <Reorder.Group
                    axis="y"
                    values={links}
                    onReorder={setLinks}
                    style={{
                        listStyle: 'none',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: CssVar.space(2),
                        margin: 0,
                        padding: 0
                    }}
                >
                    {links.map((link) => (
                        <LinkRow
                            key={link.id}
                            link={link}
                            onChange={(next) => setLinks(links.map((l) => (l.id === link.id ? next : l)))}
                            onRemove={() => setLinks(links.filter((l) => l.id !== link.id))}
                        />
                    ))}
                </Reorder.Group>
                <Button
                    variant="outlined"
                    startIcon={<MdAdd />}
                    onClick={() => setLinks([...links, { id: crypto.randomUUID(), url: '' }])}
                >
                    {t('addLink')}
                </Button>

                <div
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between'
                    }}
                >
                    <Text>{t('makeAccountPrivate')}</Text>
                    <Switch
                        checked={restricted}
                        onChange={(c) => {
                            setRestricted(c)
                        }}
                    />
                </div>
                {restricted && (
                    <>
                        <Text>{t('selectViewers')}</Text>
                        <Text variant="caption">{t('selectViewersNote')}</Text>
                        {/* UserPickerのuseSubscribeはsuspendする。外側(Profileビュー等)のSuspenseまで
                            巻き上がるとドロワーごとunmountされて編集状態が消えるので、ここで境界を切る */}
                        <Suspense fallback={null}>
                            <UserPicker selected={members} setSelected={setMembers} />
                        </Suspense>
                    </>
                )}
            </div>

            <input
                hidden
                ref={avatarInputRef}
                type="file"
                accept="image/*"
                onChange={async (e) => {
                    if (e.target.files?.[0]) {
                        const file = e.target.files[0]
                        // 同じファイルを再選択できるようにリセット
                        if (avatarInputRef.current) {
                            avatarInputRef.current.value = ''
                        }
                        const croppedFile = await cropper.open(file, {
                            aspect: 1,
                            outputWidth: 512
                        })
                        if (croppedFile) {
                            setAvatarDraft(croppedFile)
                            setAvatar(URL.createObjectURL(croppedFile))
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
                        // 同じファイルを再選択できるようにリセット
                        if (bannerInputRef.current) {
                            bannerInputRef.current.value = ''
                        }
                        const croppedFile = await cropper.open(file, {
                            aspect: 3,
                            outputWidth: 1500,
                            outputHeight: 500
                        })
                        if (croppedFile) {
                            setBannerDraft(croppedFile)
                            setBanner(URL.createObjectURL(croppedFile))
                        }
                    }
                }}
            />
        </div>
    )
}

interface LinkRowProps {
    link: { id: string; url: string }
    onChange: (link: LinkRowProps['link']) => void
    onRemove: () => void
}

// useDragControls を行ごとに持つ必要があるので、行だけコンポーネントに分けている
const LinkRow = ({ link, onChange, onRemove }: LinkRowProps) => {
    const controls = useDragControls()

    return (
        <Reorder.Item
            value={link}
            dragListener={false}
            dragControls={controls}
            style={{ listStyle: 'none', display: 'flex', alignItems: 'center', gap: CssVar.space(1) }}
        >
            <div
                onPointerDown={(e) => controls.start(e)}
                style={{ display: 'flex', cursor: 'grab', touchAction: 'none', padding: CssVar.space(1) }}
            >
                <MdDragHandle size={20} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
                <TextField
                    placeholder="https://"
                    value={link.url}
                    onChange={(e) => onChange({ ...link, url: e.target.value })}
                />
            </div>
            <IconButton onClick={onRemove}>
                <MdClose />
            </IconButton>
        </Reorder.Item>
    )
}
