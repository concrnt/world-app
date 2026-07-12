import { useTranslation } from 'react-i18next'
import { useClient } from '../contexts/Client'

import { Avatar, ListItem, Divider, Text, useTheme, List, Button } from '@concrnt/ui'

import { MdHome } from 'react-icons/md'
import { MdExplore } from 'react-icons/md'
import { MdNotifications } from 'react-icons/md'
import { MdContacts } from 'react-icons/md'
import { MdSettings } from 'react-icons/md'
import { MdTravelExplore } from 'react-icons/md'
import { MdList } from 'react-icons/md'
import { MdCreate } from 'react-icons/md'

import { CssVar } from '../types/Theme'

import { SwitchAccountButton } from './SwitchAccountButton'
import { ProfileName } from './ProfileName'
import { useNavigate } from 'react-router-dom'
import { useComposer } from '../contexts/Composer'
import { semantics } from '@concrnt/worldlib'

export const Sidebar = () => {
    const { t } = useTranslation('', { keyPrefix: 'components.sidebar' })
    const theme = useTheme()
    const { client } = useClient()
    const navigate = useNavigate()
    const composer = useComposer()

    const go = (path: string) => {
        navigate(path)
    }

    return (
        <>
            <div
                style={{
                    width: '100%',
                    height: '100%',
                    paddingTop: 'env(safe-area-inset-top)',
                    paddingBottom: 'env(safe-area-inset-bottom)',
                    backgroundColor: theme.variant === 'classic' ? CssVar.backdropBackground : 'transparent',
                    color: CssVar.backdropText,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: CssVar.space(1)
                }}
            >
                <div
                    style={{
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'center',
                        gap: CssVar.space(1),
                        padding: `${CssVar.space(1)} ${CssVar.space(2)}`
                    }}
                    onClick={() => go(`/profile/${client?.ccid || ''}/${client?.currentProfile ?? 'main'}`)}
                >
                    <div
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: CssVar.space(2)
                        }}
                    >
                        <Avatar ccid={client?.ccid || ''} src={client?.profile.avatar} />
                        <Text>
                            <ProfileName document={client?.profileDocument} />
                        </Text>
                        <div style={{ flex: 1 }} />
                        <SwitchAccountButton />
                    </div>
                    <Text variant="caption">{client?.server.domain || 'Unknown Server'}</Text>
                </div>
                <Divider />
                <List
                    dense
                    disablePadding
                    style={{
                        color: CssVar.backdropText
                    }}
                >
                    <ListItem icon={<MdHome size={24} />} onClick={() => go('/')}>
                        {t('home')}
                    </ListItem>
                    <ListItem icon={<MdNotifications size={24} />} onClick={() => go('/notifications')}>
                        {t('notifications')}
                    </ListItem>
                    <ListItem icon={<MdContacts size={24} />} onClick={() => go('/contacts')}>
                        {t('contacts')}
                    </ListItem>
                    <ListItem icon={<MdExplore size={24} />} onClick={() => go('/explorer')}>
                        {t('explore')}
                    </ListItem>
                    <ListItem icon={<MdList size={24} />} onClick={() => go('/lists')}>
                        {t('lists')}
                    </ListItem>
                    <ListItem icon={<MdTravelExplore size={24} />} onClick={() => go('/query')}>
                        {t('query')}
                    </ListItem>
                    <ListItem icon={<MdSettings size={24} />} onClick={() => go('/settings')}>
                        {t('settings')}
                    </ListItem>
                </List>
                <div style={{ flex: 1 }} />
                <Button
                    onClick={() => {
                        const home = semantics.homeTimeline(client.ccid, client.currentProfile)
                        composer.open([home])
                    }}
                    style={{ width: '100%' }}
                >
                    <MdCreate size={20} />
                    {t('post')}
                </Button>

                <Divider
                    style={{
                        marginTop: CssVar.space(2)
                    }}
                />

                <div
                    style={{
                        fontSize: '0.6rem',
                        padding: CssVar.space(1),
                        textAlign: 'center'
                    }}
                >
                    Concrnt World App
                    <br />
                    <a
                        style={{
                            color: CssVar.uiText,
                            textDecoration: 'none'
                        }}
                        href="https://square.concrnt.net/"
                        target="_blank"
                        rel="noreferrer"
                    >
                        {t('documentation')}
                    </a>
                    {' / '}
                    <a
                        style={{
                            color: CssVar.uiText,
                            textDecoration: 'none'
                        }}
                        href="https://github.com/orgs/concrnt/discussions"
                        target="_blank"
                        rel="noreferrer"
                    >
                        {t('forum')}
                    </a>
                    {' / '}
                    <a
                        style={{
                            color: CssVar.uiText,
                            textDecoration: 'none'
                        }}
                        href="https://github.com/totegamma/concurrent-world"
                        target="_blank"
                        rel="noreferrer"
                    >
                        GitHub
                    </a>
                </div>
            </div>
        </>
    )
}
