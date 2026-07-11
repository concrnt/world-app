import { useClient } from '../contexts/Client'
import { useSelect } from '../contexts/Select'
import { Avatar, CssVar, IconButton, ListItem, Text } from '@concrnt/ui'
import { ReactNode, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useDrawer } from '../contexts/Drawer'
import { ProfileEditor } from './ProfileEditor'
import { semantics } from '@concrnt/worldlib'
import { HiSwitchHorizontal } from 'react-icons/hi'
import { MdPersonAdd } from 'react-icons/md'
import { ProfileName } from './ProfileName'

export const SwitchAccountButton = (): ReactNode => {
    const { t } = useTranslation('', { keyPrefix: 'components.switchAccountButton' })
    const { client, reload } = useClient()
    const { select, close } = useSelect()
    const drawer = useDrawer()

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
                            title={t('createNewProfile')}
                        />
                    )
                }}
            >
                <Text>{t('addProfile')}</Text>
            </ListItem>
        )

        return result
    }, [client, reload, close, drawer, t])

    return (
        <IconButton
            onClick={(e) => {
                e.stopPropagation()
                if (!client) return
                select(t('switchAccountTitle'), options)
            }}
        >
            <HiSwitchHorizontal size={20} color={CssVar.backdropText} />
        </IconButton>
    )
}
