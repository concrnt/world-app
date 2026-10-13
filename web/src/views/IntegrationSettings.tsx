import { List, ListItem } from '@concrnt/ui'
import { MdChevronRight } from 'react-icons/md'
import { SiActivitypub, SiBluesky } from 'react-icons/si'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { useClient } from '../contexts/Client'
import { CssVar } from '../types/Theme'
import { Header } from '../components/Header'
import { View } from '../components/View'

export const IntegrationSettingsView = () => {
    const { t } = useTranslation('', { keyPrefix: 'views.integrationSettings' })
    const { client } = useClient()
    const navigate = useNavigate()

    const activitypubEnabled = 'net.concrnt.activitypub.settings' in (client.server?.endpoints ?? {})
    const blueskyEnabled = 'world.concrnt.atproto.info' in (client.server?.endpoints ?? {})

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
                <List>
                    {activitypubEnabled && (
                        <ListItem
                            startIcon={<SiActivitypub size={24} />}
                            endIcon={<MdChevronRight size={24} />}
                            onClick={() => navigate('/settings/activitypub')}
                        >
                            {t('activitypub')}
                        </ListItem>
                    )}
                    {blueskyEnabled && (
                        <ListItem
                            startIcon={<SiBluesky size={24} />}
                            endIcon={<MdChevronRight size={24} />}
                            onClick={() => navigate('/settings/bluesky')}
                        >
                            {t('bluesky')}
                        </ListItem>
                    )}
                </List>
            </div>
        </View>
    )
}
