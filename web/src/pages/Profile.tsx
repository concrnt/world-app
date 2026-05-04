import { Suspense, use } from 'react'
import { Avatar, Button, CCWallpaper, CssVar, Tab, Tabs, Text, View } from '@concrnt/ui'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { Schemas, semantics, type ProfileSchema, type User } from '@concrnt/worldlib'
import type { Document } from '@concrnt/client'
import { AcknowledgeButton } from '../components/AcknowledgeButton'
import { Modal } from '../components/Modal'
import { ProfileEditor } from '../components/ProfileEditor'
import { QueryTimeline } from '../components/QueryTimeline'
import { useClient } from '../contexts/Client'
import { Header } from '../ui/Header'
import { useState } from 'react'

type ProfileTab = 'posts' | 'media' | 'activity'

export const Profile = () => {
    const { client } = useClient()
    const { ccid } = useParams()
    const [searchParams] = useSearchParams()
    const targetCcid = decodeURIComponent(ccid ?? client!.ccid)
    const profileName = searchParams.get('profile') ?? (targetCcid === client!.ccid ? client!.currentProfile : 'main')

    const userPromise = client!.getUser(targetCcid).catch(() => null)
    const profilePromise = client!.api
        .getDocument<ProfileSchema>(semantics.profile(targetCcid, profileName))
        .catch(() => null)

    return (
        <View
            style={{
                margin: 0,
                height: '100%',
                minHeight: 0
            }}
        >
            <Header
                left={
                    <Link to="/" style={{ color: 'inherit', textDecoration: 'none' }}>
                        Back
                    </Link>
                }
            >
                Profile
            </Header>
            <Suspense fallback={<ProfileStatus label="プロフィールを読み込んでいます..." />}>
                <ProfileBody
                    ccid={targetCcid}
                    profileName={profileName}
                    userPromise={userPromise}
                    profilePromise={profilePromise}
                />
            </Suspense>
        </View>
    )
}

const ProfileBody = (props: {
    ccid: string
    profileName: string
    userPromise: Promise<User | null>
    profilePromise: Promise<Document<ProfileSchema> | null>
}) => {
    const { client } = useClient()
    const navigate = useNavigate()
    const [tab, setTab] = useState<ProfileTab>('posts')
    const [editorOpen, setEditorOpen] = useState(false)
    const user = use(props.userPromise)
    const profile = use(props.profilePromise)

    if (!client || !user) {
        return <ProfileStatus label="ユーザーが見つかりませんでした。" />
    }

    const profileValue = profile?.value ?? {
        username: 'Anonymous',
        description: '',
        avatar: '',
        banner: ''
    }

    const prefix =
        tab === 'activity'
            ? semantics.activityTimeline(props.ccid, props.profileName)
            : semantics.homeTimeline(props.ccid, props.profileName)

    const query = tab === 'media' ? { schema: Schemas.mediaMessage } : undefined

    return (
        <>
            <div
                style={{
                    overflowY: 'auto',
                    minHeight: 0,
                    flex: 1,
                    display: 'flex',
                    flexDirection: 'column'
                }}
            >
                <CCWallpaper
                    src={profileValue.banner}
                    style={{
                        height: '180px'
                    }}
                />
                <div
                    style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: CssVar.space(3),
                        padding: CssVar.space(4)
                    }}
                >
                    <div
                        style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'flex-start',
                            gap: CssVar.space(3)
                        }}
                    >
                        <div
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: CssVar.space(3)
                            }}
                        >
                            <Avatar
                                ccid={props.ccid}
                                src={profileValue.avatar}
                                style={{
                                    width: '96px',
                                    height: '96px',
                                    marginTop: '-52px',
                                    border: `4px solid ${CssVar.contentBackground}`
                                }}
                            />
                            <div>
                                <Text variant="h2">{profileValue.username ?? 'Anonymous'}</Text>
                                <Text variant="caption">{props.ccid}</Text>
                            </div>
                        </div>
                        {client.ccid === props.ccid ? (
                            <Button
                                variant="outlined"
                                onClick={() => {
                                    setEditorOpen(true)
                                }}
                            >
                                Edit Profile
                            </Button>
                        ) : (
                            <AcknowledgeButton ccid={props.ccid} />
                        )}
                    </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: CssVar.space(2) }}>
                            <Text>{profileValue.description || '説明はまだありません。'}</Text>
                            <ProfileStats
                                user={user}
                                onOpen={(tab) =>
                                    navigate(`/contacts/${encodeURIComponent(props.ccid)}?tab=${encodeURIComponent(tab)}`)
                                }
                            />
                        </div>
                    </div>

                <Tabs
                    style={{
                        paddingInline: CssVar.space(2),
                        borderTop: `1px solid ${CssVar.divider}`,
                        borderBottom: `1px solid ${CssVar.divider}`
                    }}
                >
                    <Tab selected={tab === 'posts'} onClick={() => setTab('posts')} groupId="profile-tabs" style={{ color: CssVar.contentText }}>
                        Posts
                    </Tab>
                    <Tab selected={tab === 'media'} onClick={() => setTab('media')} groupId="profile-tabs" style={{ color: CssVar.contentText }}>
                        Media
                    </Tab>
                    <Tab selected={tab === 'activity'} onClick={() => setTab('activity')} groupId="profile-tabs" style={{ color: CssVar.contentText }}>
                        Activity
                    </Tab>
                </Tabs>

                <div
                    style={{
                        minHeight: 0,
                        flex: 1,
                        display: 'flex'
                    }}
                >
                    <QueryTimeline
                        prefix={prefix}
                        query={query}
                        emptyLabel={tab === 'media' ? 'メディア付き投稿はまだありません。' : '投稿がまだありません。'}
                    />
                </div>
            </div>
            {client.ccid === props.ccid && editorOpen && (
                <Modal title="プロフィールを編集" onClose={() => setEditorOpen(false)} width="720px">
                    <ProfileEditor
                        profileName={props.profileName}
                        onComplete={(nextProfileName) => {
                            setEditorOpen(false)
                            if (nextProfileName !== client.currentProfile) {
                                void navigate(
                                    `/profile/${encodeURIComponent(props.ccid)}?profile=${encodeURIComponent(nextProfileName)}`
                                )
                            }
                        }}
                    />
                </Modal>
            )}
        </>
    )
}

const ProfileStats = (props: { user: User; onOpen: (tab: 'acknowledging' | 'acknowledgers') => void }) => {
    const [stats] = [use(props.user.stats.value())]

    return (
        <div
            style={{
                display: 'flex',
                gap: CssVar.space(3)
            }}
        >
            <button
                type="button"
                onClick={() => props.onOpen('acknowledging')}
                style={{
                    padding: 0,
                    border: 'none',
                    backgroundColor: 'transparent',
                    color: CssVar.contentText,
                    cursor: 'pointer'
                }}
            >
                <Text variant="caption">{stats.acknowledging} フォロー</Text>
            </button>
            <button
                type="button"
                onClick={() => props.onOpen('acknowledgers')}
                style={{
                    padding: 0,
                    border: 'none',
                    backgroundColor: 'transparent',
                    color: CssVar.contentText,
                    cursor: 'pointer'
                }}
            >
                <Text variant="caption">{stats.acknowledged} フォロワー</Text>
            </button>
        </div>
    )
}

const ProfileStatus = (props: { label: string }) => {
    return (
        <div
            style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: CssVar.space(4)
            }}
        >
            <Text>{props.label}</Text>
        </div>
    )
}
