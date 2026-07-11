import { useClient } from '../contexts/Client'
import { useSelect } from '../contexts/Select'
import { Avatar, CssVar, IconButton, ListItem, Text, useAnchor } from '@concrnt/ui'
import { ReactNode, useMemo } from 'react'
import { useDrawer } from '../contexts/Drawer'
import { ProfileEditor } from './ProfileEditor'
import { semantics } from '@concrnt/worldlib'
import { HiSwitchHorizontal } from 'react-icons/hi'
import { MdPersonAdd } from 'react-icons/md'
import { ProfileName } from './ProfileName'

export const SwitchAccountButton = (): ReactNode => {
    const { client, reload } = useClient()
    const { select, close } = useSelect()
    const drawer = useDrawer()
    const menuAnchor = useAnchor()

    const options: ReactNode[] = useMemo(() => {
        const result: ReactNode[] = []
        if (!client) return result

        for (const [key, profile] of Object.entries(client.profiles)) {
            result.push(
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
                        close()
                        drawer.close()
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

        result.push(
            <ListItem
                key={'$add'}
                icon={<MdPersonAdd size={24} />}
                onClick={() => {
                    drawer.open(
                        <ProfileEditor
                            noLoading
                            onComplete={() => {
                                close()
                                drawer.close()
                            }}
                            targetURI={semantics.profile(client.ccid, Date.now().toString())}
                            title="Create New Profile"
                        />
                    )
                }}
            >
                <Text>プロフィールを追加</Text>
            </ListItem>
        )

        return result
    }, [client, reload, close, drawer])

    return (
        <IconButton
            onClick={(e) => {
                e.stopPropagation()
                if (!client) return
                select('Switch Account', options, menuAnchor)
            }}
            style={{ anchorName: menuAnchor } as React.CSSProperties}
        >
            <HiSwitchHorizontal size={20} color={CssVar.backdropText} />
        </IconButton>
    )
}
