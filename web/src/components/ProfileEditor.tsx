import { useEffect, useMemo, useRef, useState } from 'react'
import type { Document } from '@concrnt/client'
import { Button, CCWallpaper, CssVar, Text, TextField } from '@concrnt/ui'
import { NotFoundError } from '@concrnt/client'
import { Schemas, semantics, type ProfileSchema } from '@concrnt/worldlib'
import { useClient } from '../contexts/Client'
import { uploadImage } from '../util/uploadImage'
import { AvatarUploader } from './AvatarUploader'

interface Props {
    profileName?: string
    title?: string
    onComplete?: (profileName: string) => void
}

const emptyProfile: ProfileSchema = {
    username: '',
    description: '',
    avatar: '',
    banner: ''
}

export const ProfileEditor = (props: Props) => {
    const { client } = useClient()
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState<string | undefined>(undefined)
    const [profileName, setProfileName] = useState(props.profileName ?? '')
    const [username, setUsername] = useState('')
    const [description, setDescription] = useState('')
    const [avatar, setAvatar] = useState('')
    const [banner, setBanner] = useState('')
    const [avatarDraft, setAvatarDraft] = useState<File | null>(null)
    const [bannerDraft, setBannerDraft] = useState<File | null>(null)
    const bannerInputRef = useRef<HTMLInputElement | null>(null)
    const [bannerPreviewUrl, setBannerPreviewUrl] = useState<string | undefined>(undefined)
    const targetProfileName = useMemo(() => props.profileName ?? profileName.trim(), [props.profileName, profileName])
    const targetUri = client ? semantics.profile(client.ccid, targetProfileName || 'main') : null

    useEffect(() => {
        if (!client || !props.profileName) {
            setLoading(false)
            return
        }

        let cancelled = false
        setLoading(true)
        setError(undefined)

        void client.api
            .getDocument<ProfileSchema>(semantics.profile(client.ccid, props.profileName))
            .then((document) => {
                if (cancelled) return
                setUsername(document.value.username ?? '')
                setDescription(document.value.description ?? '')
                setAvatar(document.value.avatar ?? '')
                setBanner(document.value.banner ?? '')
            })
            .catch((caught) => {
                if (cancelled) return
                if (caught instanceof NotFoundError) {
                    setUsername('')
                    setDescription('')
                    setAvatar('')
                    setBanner('')
                    return
                }
                setError(caught instanceof Error ? caught.message : 'プロフィールの読み込みに失敗しました。')
            })
            .finally(() => {
                if (!cancelled) {
                    setLoading(false)
                }
            })

        return () => {
            cancelled = true
        }
    }, [client, props.profileName])

    useEffect(() => {
        return () => {
            if (bannerPreviewUrl) {
                URL.revokeObjectURL(bannerPreviewUrl)
            }
        }
    }, [bannerPreviewUrl])

    if (!client) return null

    const handleSave = async () => {
        const nextProfileName = (props.profileName ?? profileName).trim()
        if (!nextProfileName) {
            setError('プロフィール名を入力してください。')
            return
        }

        setSaving(true)
        setError(undefined)

        try {
            const value: ProfileSchema = {
                ...emptyProfile,
                username: username.trim() || 'Anonymous',
                description: description.trim(),
                avatar,
                banner
            }

            if (avatarDraft) {
                value.avatar = await uploadImage(client, avatarDraft)
            }

            if (bannerDraft) {
                value.banner = await uploadImage(client, bannerDraft)
            }

            const document: Document<ProfileSchema> = {
                key: semantics.profile(client.ccid, nextProfileName),
                schema: Schemas.profile,
                value,
                author: client.ccid,
                createdAt: new Date()
            }

            await client.api.commit(document)
            client.updateProfiles()
            props.onComplete?.(nextProfileName)
        } catch (caught) {
            setError(caught instanceof Error ? caught.message : 'プロフィールの保存に失敗しました。')
        } finally {
            setSaving(false)
        }
    }

    return (
        <div
            style={{
                display: 'flex',
                flexDirection: 'column',
                gap: CssVar.space(4),
                padding: CssVar.space(4),
                overflowY: 'auto'
            }}
        >
            <div
                style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: CssVar.space(1)
                }}
            >
                <Text variant="h3">{props.title ?? 'Edit Profile'}</Text>
                <Text variant="caption" style={{ opacity: 0.72 }}>
                    {props.profileName ? `profile: ${props.profileName}` : '新しいプロフィールを作成します。'}
                </Text>
            </div>

            {loading ? (
                <Text>プロフィールを読み込んでいます...</Text>
            ) : (
                <>
                    {!props.profileName && (
                        <div
                            style={{
                                display: 'flex',
                                flexDirection: 'column',
                                gap: CssVar.space(2)
                            }}
                        >
                            <Text variant="h3">Profile Name</Text>
                            <TextField
                                value={profileName}
                                onChange={(event) => setProfileName(event.target.value)}
                                placeholder="main / work / private"
                            />
                        </div>
                    )}

                    <div
                        style={{
                            display: 'flex',
                            flexDirection: 'column',
                            gap: CssVar.space(2)
                        }}
                    >
                        <Text variant="h3">Banner</Text>
                        <button
                            type="button"
                            onClick={() => bannerInputRef.current?.click()}
                            style={{
                                padding: 0,
                                border: `1px solid ${CssVar.divider}`,
                                borderRadius: CssVar.round(1),
                                backgroundColor: 'transparent',
                                overflow: 'hidden',
                                cursor: 'pointer'
                            }}
                        >
                            <CCWallpaper
                                src={bannerPreviewUrl ?? banner}
                                style={{
                                    height: '180px'
                                }}
                            />
                        </button>
                        <div style={{ display: 'flex', alignItems: 'center', gap: CssVar.space(2), flexWrap: 'wrap' }}>
                            <Button variant="outlined" onClick={() => bannerInputRef.current?.click()}>
                                バナー画像を選択
                            </Button>
                            <Text variant="caption" style={{ opacity: 0.72 }}>
                                横長画像を推奨
                            </Text>
                        </div>
                        <input
                            ref={bannerInputRef}
                            hidden
                            type="file"
                            accept="image/*"
                            onChange={(event) => {
                                const file = event.target.files?.[0]
                                if (!file) return

                                if (bannerPreviewUrl) {
                                    URL.revokeObjectURL(bannerPreviewUrl)
                                }

                                const nextPreviewUrl = URL.createObjectURL(file)
                                setBannerPreviewUrl(nextPreviewUrl)
                                setBannerDraft(file)
                                event.target.value = ''
                            }}
                        />
                    </div>

                    <AvatarUploader
                        ccid={client.ccid}
                        src={avatar}
                        label="プロフィール画像"
                        onFileSelect={(file) => {
                            setAvatarDraft(file)
                            setAvatar('')
                        }}
                    />

                    <div
                        style={{
                            display: 'flex',
                            flexDirection: 'column',
                            gap: CssVar.space(2)
                        }}
                    >
                        <Text variant="h3">Username</Text>
                        <TextField value={username} onChange={(event) => setUsername(event.target.value)} placeholder="Anonymous" />
                    </div>

                    <div
                        style={{
                            display: 'flex',
                            flexDirection: 'column',
                            gap: CssVar.space(2)
                        }}
                    >
                        <Text variant="h3">Description</Text>
                        <textarea
                            value={description}
                            onChange={(event) => setDescription(event.target.value)}
                            placeholder="自己紹介"
                            style={{
                                width: '100%',
                                minHeight: 120,
                                padding: CssVar.space(3),
                                borderRadius: CssVar.round(1),
                                border: `1px solid ${CssVar.divider}`,
                                boxSizing: 'border-box',
                                backgroundColor: CssVar.contentBackground,
                                color: CssVar.contentText,
                                resize: 'vertical'
                            }}
                        />
                    </div>

                    {targetUri && (
                        <Text variant="caption" style={{ opacity: 0.72 }}>
                            {targetUri}
                        </Text>
                    )}

                    {error && (
                        <Text
                            style={{
                                opacity: 0.9
                            }}
                        >
                            {error}
                        </Text>
                    )}

                    <div
                        style={{
                            display: 'flex',
                            justifyContent: 'flex-end'
                        }}
                    >
                        <Button disabled={saving} onClick={() => void handleSave()}>
                            {saving ? '保存中...' : '保存'}
                        </Button>
                    </div>
                </>
            )}
        </div>
    )
}
