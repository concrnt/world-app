import { useState } from 'react'
import { Button, CssVar, Divider, Popup, Text } from '@concrnt/ui'
import { MdAdd, MdSwapHoriz } from 'react-icons/md'
import { useNavigate } from 'react-router-dom'
import { useClient } from '../contexts/Client'
import { Modal } from './Modal'
import { ProfileEditor } from './ProfileEditor'

export const SwitchAccountButton = () => {
    const { client, reload } = useClient()
    const navigate = useNavigate()
    const [open, setOpen] = useState(false)
    const [editorOpen, setEditorOpen] = useState(false)
    const profileEntries = client ? Object.entries(client.profiles) : []

    if (!client) {
        return null
    }

    return (
        <>
            <Popup
                open={open}
                onOpenChange={setOpen}
                trigger={
                    <Button
                        variant="text"
                        onClick={(event) => {
                            event.stopPropagation()
                            setOpen((current) => !current)
                        }}
                    >
                        <MdSwapHoriz size={18} />
                    </Button>
                }
                popupStyle={{
                    width: '320px'
                }}
            >
                <div
                    style={{
                        display: 'flex',
                        flexDirection: 'column',
                        padding: CssVar.space(2),
                        gap: CssVar.space(1)
                    }}
                >
                    {profileEntries.map(([profileName, profile]) => {
                        const isCurrent = profileName === client.currentProfile

                        return (
                            <button
                                key={profileName}
                                type="button"
                                onClick={() => {
                                    void reload(profileName).then(() => {
                                        setOpen(false)
                                        navigate(`/profile/${encodeURIComponent(client.ccid)}?profile=${encodeURIComponent(profileName)}`)
                                    })
                                }}
                                style={{
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: CssVar.space(1),
                                    width: '100%',
                                    padding: CssVar.space(3),
                                    border: 'none',
                                    borderRadius: CssVar.round(1),
                                    backgroundColor: isCurrent ? CssVar.uiBackground : 'transparent',
                                    color: isCurrent ? CssVar.uiText : CssVar.contentText,
                                    textAlign: 'left',
                                    cursor: 'pointer'
                                }}
                            >
                                <Text variant="h3">{profile.value.username || profileName}</Text>
                                <Text variant="caption" style={{ opacity: 0.78 }}>
                                    {profileName === 'main' ? 'main profile' : profileName}
                                </Text>
                            </button>
                        )
                    })}
                    <Divider />
                    <Button
                        variant="outlined"
                        onClick={() => {
                            setOpen(false)
                            setEditorOpen(true)
                        }}
                    >
                        <MdAdd size={18} />
                        新しいプロフィール
                    </Button>
                </div>
            </Popup>
            {editorOpen && (
                <Modal title="プロフィールを追加" onClose={() => setEditorOpen(false)} width="720px">
                    <ProfileEditor
                        title="Create Profile"
                        onComplete={(nextProfileName) => {
                            void reload(nextProfileName).then(() => {
                                setEditorOpen(false)
                                navigate(`/profile/${encodeURIComponent(client.ccid)}?profile=${encodeURIComponent(nextProfileName)}`)
                            })
                        }}
                    />
                </Modal>
            )}
        </>
    )
}
