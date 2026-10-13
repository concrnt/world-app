import { Button, View, Divider, Text, List, ListItem } from '@concrnt/ui'
import { useClient } from '../contexts/Client'
import { getResourceCache } from '../lib/cache'
import { Header } from '../ui/Header'
import { usePreference, useResetPreference } from '../contexts/Preference'
import { CssVar } from '../types/Theme'
import { useStack } from '../layouts/Stack'
import { IDView } from './ID'
import { DevView } from './Dev'
import { DisplaySettingsView } from './DisplaySettings'
import { IntegrationSettingsView } from './IntegrationSettings'
import { NotificationSettingsView } from './NotificationSettings'
import { MediaSettingsView } from './MediaSettings'
import { ListsView } from './Lists'
import {
    MdBadge,
    MdChevronRight,
    MdDisplaySettings,
    MdHub,
    MdList,
    MdNotifications,
    MdPermMedia,
    MdTerminal
} from 'react-icons/md'
import { Fragment, useState } from 'react'
import { useTranslation } from 'react-i18next'
import buildTime from '~build/time'
import { branch, sha } from '~build/git'
import { version } from '~build/package'

const branchName = branch || window.location.host.split('.')[0]
const appInfoRows = [
    ['version', version],
    ['buildTime', buildTime.toLocaleString()],
    ['branch', branchName],
    ['commit', sha]
]

export const SettingsView = () => {
    const { t } = useTranslation('', { keyPrefix: 'views.settings' })
    const { client, logout } = useClient()

    const reset = useResetPreference()
    const stack = useStack()
    const [developerMode, setDeveloperMode] = usePreference('developerMode')
    const [, setAppInfoTapCount] = useState(0)

    const activitypubEnabled = 'net.concrnt.activitypub.settings' in (client.server?.endpoints ?? {})
    const blueskyEnabled = 'world.concrnt.atproto.info' in (client.server?.endpoints ?? {})
    const integrationsEnabled = activitypubEnabled || blueskyEnabled
    const mediaEnabled = 'net.concrnt.storage.list' in (client.server?.endpoints ?? {})

    const handleAppInfoClick = () => {
        if (developerMode) return

        setAppInfoTapCount((count) => {
            const nextCount = count + 1
            if (nextCount >= 7) {
                setDeveloperMode(true)
                return 0
            }
            return nextCount
        })
    }

    return (
        <View>
            <Header>{t('title')}</Header>
            <div
                style={{
                    flex: 1,
                    overflowY: 'auto',
                    touchAction: 'pan-y',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: CssVar.space(3),
                    padding: CssVar.space(4)
                }}
            >
                <Text variant="h3">{t('title')}</Text>
                <List>
                    <ListItem
                        startIcon={<MdBadge size={24} />}
                        endIcon={<MdChevronRight size={24} />}
                        onClick={() => stack.push(<IDView />)}
                    >
                        {t('id')}
                    </ListItem>
                    <ListItem
                        startIcon={<MdNotifications size={24} />}
                        endIcon={<MdChevronRight size={24} />}
                        onClick={() => stack.push(<NotificationSettingsView />)}
                    >
                        {t('notifications')}
                    </ListItem>
                    <ListItem
                        startIcon={<MdList size={24} />}
                        endIcon={<MdChevronRight size={24} />}
                        onClick={() => stack.push(<ListsView />)}
                    >
                        {t('lists')}
                    </ListItem>
                    <ListItem
                        startIcon={<MdDisplaySettings size={24} />}
                        endIcon={<MdChevronRight size={24} />}
                        onClick={() => stack.push(<DisplaySettingsView />)}
                    >
                        {t('display')}
                    </ListItem>
                    {mediaEnabled && (
                        <ListItem
                            startIcon={<MdPermMedia size={24} />}
                            endIcon={<MdChevronRight size={24} />}
                            onClick={() => stack.push(<MediaSettingsView />)}
                        >
                            {t('media')}
                        </ListItem>
                    )}
                    {integrationsEnabled && (
                        <ListItem
                            startIcon={<MdHub size={24} />}
                            endIcon={<MdChevronRight size={24} />}
                            onClick={() => stack.push(<IntegrationSettingsView />)}
                        >
                            {t('integrations')}
                        </ListItem>
                    )}
                    {developerMode && (
                        <ListItem
                            startIcon={<MdTerminal size={24} />}
                            endIcon={<MdChevronRight size={24} />}
                            onClick={() => stack.push(<DevView />)}
                        >
                            {t('devTools')}
                        </ListItem>
                    )}
                </List>

                <Divider />

                <Text variant="h3">{t('account')}</Text>
                <Button
                    onClick={async () => {
                        await getResourceCache(client.ccid).clear()
                        window.location.reload()
                    }}
                >
                    {t('clearCache')}
                </Button>
                <Button
                    onClick={() => {
                        logout()
                        reset()
                    }}
                >
                    {t('logout')}
                </Button>

                <Divider />

                <div
                    onClick={handleAppInfoClick}
                    style={{
                        border: `1px solid ${CssVar.divider}`,
                        borderRadius: 8,
                        padding: CssVar.space(1.5),
                        display: 'flex',
                        flexDirection: 'column',
                        gap: CssVar.space(0.75),
                        opacity: 0.78,
                        userSelect: 'none'
                    }}
                >
                    <Text variant="caption" style={{ margin: 0, fontWeight: 700 }}>
                        {t('appInfo.title')}
                    </Text>
                    <dl
                        style={{
                            margin: 0,
                            display: 'grid',
                            gridTemplateColumns: 'max-content minmax(0, 1fr)',
                            gap: `${CssVar.space(0.25)} ${CssVar.space(1)}`,
                            fontSize: '0.75rem',
                            lineHeight: 1.45
                        }}
                    >
                        {appInfoRows.map(([label, value]) => (
                            <Fragment key={label}>
                                <dt style={{ margin: 0 }}>{t(`appInfo.${label}`)}</dt>
                                <dd style={{ margin: 0, minWidth: 0, wordBreak: 'break-all' }}>{value}</dd>
                            </Fragment>
                        ))}
                    </dl>
                </div>
            </div>
        </View>
    )
}
