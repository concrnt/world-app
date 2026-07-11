import { Button, Divider, Text, List, ListItem } from '@concrnt/ui'
import { useClient } from '../contexts/Client'
import { resourceCache } from '../lib/cache'
import { usePreference, useResetPreference } from '../contexts/Preference'
import { CssVar } from '../types/Theme'
import { Header } from '../components/Header'
import { View } from '../components/View'
import { useNavigate } from 'react-router-dom'
import {
    MdBadge,
    MdChevronRight,
    MdEmojiEmotions,
    MdLanguage,
    MdNotifications,
    MdPalette,
    MdTerminal
} from 'react-icons/md'
import { SiActivitypub } from 'react-icons/si'
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
    const { logout } = useClient()

    const reset = useResetPreference()
    const navigate = useNavigate()
    const [developerMode, setDeveloperMode] = usePreference('developerMode')
    const [, setAppInfoTapCount] = useState(0)

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
                    display: 'flex',
                    flexDirection: 'column',
                    gap: CssVar.space(3),
                    padding: CssVar.space(4)
                }}
            >
                <Text variant="h3">{t('title')}</Text>
                <List>
                    <ListItem
                        startIcon={<MdPalette size={24} />}
                        endIcon={<MdChevronRight size={24} />}
                        onClick={() => navigate('/settings/theme')}
                    >
                        {t('theme')}
                    </ListItem>
                    <ListItem
                        startIcon={<MdLanguage size={24} />}
                        endIcon={<MdChevronRight size={24} />}
                        onClick={() => navigate('/settings/language')}
                    >
                        {t('language')}
                    </ListItem>
                    <ListItem
                        startIcon={<SiActivitypub size={24} />}
                        endIcon={<MdChevronRight size={24} />}
                        onClick={() => navigate('/settings/activitypub')}
                    >
                        {t('activitypub')}
                    </ListItem>
                    <ListItem
                        startIcon={<MdBadge size={24} />}
                        endIcon={<MdChevronRight size={24} />}
                        onClick={() => navigate('/settings/id')}
                    >
                        {t('id')}
                    </ListItem>
                    <ListItem
                        startIcon={<MdEmojiEmotions size={24} />}
                        endIcon={<MdChevronRight size={24} />}
                        onClick={() => navigate('/settings/emoji')}
                    >
                        {t('emoji')}
                    </ListItem>
                    <ListItem
                        startIcon={<MdNotifications size={24} />}
                        endIcon={<MdChevronRight size={24} />}
                        onClick={() => navigate('/settings/notifications')}
                    >
                        {t('notifications')}
                    </ListItem>
                    {developerMode && (
                        <ListItem
                            startIcon={<MdTerminal size={24} />}
                            endIcon={<MdChevronRight size={24} />}
                            onClick={() => navigate('/settings/dev')}
                        >
                            {t('devTools')}
                        </ListItem>
                    )}
                </List>

                <Divider />

                <Text variant="h3">{t('account')}</Text>
                <Button
                    onClick={async () => {
                        await resourceCache.clear()
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
