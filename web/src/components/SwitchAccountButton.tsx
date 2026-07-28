import { useClient } from '../contexts/Client'
import { Avatar, CssVar, IconButton, ListItem, Text, useAnchor } from '@concrnt/ui'
import { ReactNode, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Drawer } from './Drawer'
import { Select } from './Select'
import { ProfileEditor } from './ProfileEditor'
import { semantics } from '@concrnt/worldlib'
import { HiSwitchHorizontal } from 'react-icons/hi'
import { MdPersonAdd } from 'react-icons/md'
import { ProfileName } from './ProfileName'

export const SwitchAccountButton = (): ReactNode => {
    const { t } = useTranslation('', { keyPrefix: 'components.switchAccountButton' })
    const { client, reload } = useClient()
    const menuAnchor = useAnchor()

    const [menuOpen, setMenuOpen] = useState(false)
    // 新規プロフィールのキーは開いた時点で採番して固定する
    const [newProfileURI, setNewProfileURI] = useState<string | null>(null)

    const options: ReactNode[] = []
    if (client) {
        for (const [key, profile] of Object.entries(client.profiles)) {
            options.push(
                <ListItem
                    key={key}
                    style={{ marginBottom: CssVar.space(1) }}
                    icon={
                        <Avatar
                            ccid={profile.author}
                            src={profile.value.avatar}
                            style={{ width: '32px', height: '32px' }}
                        />
                    }
                    onClick={() => {
                        console.log('Switching account to', key)
                        reload(key)
                        setMenuOpen(false)
                    }}
                >
                    <div
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            paddingLeft: CssVar.space(2)
                        }}
                    >
                        <Text>
                            <ProfileName document={profile} />
                        </Text>
                    </div>
                </ListItem>
            )
        }

        options.push(
            <ListItem
                key={'$add'}
                icon={<MdPersonAdd size={24} />}
                onClick={() => {
                    setNewProfileURI(semantics.profile(client.ccid, Date.now().toString()))
                }}
            >
                <Text>{t('addProfile')}</Text>
            </ListItem>
        )
    }

    return (
        <>
            <IconButton
                onClick={(e) => {
                    e.stopPropagation()
                    if (!client) return
                    setMenuOpen(true)
                }}
                style={{ anchorName: menuAnchor } as React.CSSProperties}
            >
                <HiSwitchHorizontal size={20} color={CssVar.backdropText} />
            </IconButton>
            <Select
                open={menuOpen}
                onClose={() => setMenuOpen(false)}
                title={t('switchAccountTitle')}
                options={options}
                anchor={menuAnchor}
            />
            <Drawer open={newProfileURI !== null} onClose={() => setNewProfileURI(null)}>
                {newProfileURI && (
                    <ProfileEditor
                        noLoading
                        onComplete={() => {
                            setMenuOpen(false)
                            setNewProfileURI(null)
                        }}
                        targetURI={newProfileURI}
                        title={t('createNewProfile')}
                    />
                )}
            </Drawer>
        </>
    )
}
