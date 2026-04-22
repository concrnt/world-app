import { HiOutlineDotsCircleHorizontal } from 'react-icons/hi'
import { useClient } from '../contexts/Client'
import { useSelect } from '../contexts/Select'
import { Avatar, CssVar, IconButton, Text } from '@concrnt/ui'
import { ReactNode, useMemo } from 'react'
import { useDrawer } from '../contexts/Drawer'
import { ProfileEditor } from './ProfileEditor'
import { semantics } from '@concrnt/worldlib'

export const SwitchAccountButton = (): ReactNode => {
    const { client, reload } = useClient()
    const { select } = useSelect()
    const drawer = useDrawer()

    const options: Record<string, ReactNode> = useMemo(() => {
        const result: Record<string, ReactNode> = {}
        if (!client) return result

        for (const [key, profile] of Object.entries(client.profiles)) {
            result[key] = (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Avatar ccid={profile.author} src={profile.value.avatar} />
                    <Text>{profile.value.username}</Text>
                </div>
            )
        }

        result['$add'] = (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Text>アカウントを追加</Text>
            </div>
        )

        return result
    }, [client])

    const handler = (key: string) => {
        if (!client) return
        console.log('Switching account to', key)

        const newId = Date.now().toString()

        if (key === '$add') {
            drawer.open(
                <ProfileEditor
                    onComplete={() =>
                        //client.
                        drawer.close()
                    }
                    targetURI={semantics.profile(client.ccid, newId)}
                    title="Create New Profile"
                />
            )
        } else {
            reload(key)
        }
    }

    return (
        <IconButton
            onClick={(e) => {
                e.stopPropagation()
                if (!client) return
                select('Switch Account', options, handler)
            }}
        >
            <HiOutlineDotsCircleHorizontal size={20} color={CssVar.backdropText} />
        </IconButton>
    )
}
