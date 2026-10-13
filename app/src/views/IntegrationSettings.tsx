import { View, List, ListItem } from '@concrnt/ui'
import { MdChevronRight } from 'react-icons/md'
import { SiActivitypub, SiBluesky } from 'react-icons/si'
import { useTranslation } from 'react-i18next'
import { useClient } from '../contexts/Client'
import { CssVar } from '../types/Theme'
import { Header } from '../ui/Header'
import { useStack } from '../layouts/Stack'
import { Activitypub } from './Activitypub'
import { Bluesky } from './Bluesky'

export const IntegrationSettingsView = () => {
    const { t } = useTranslation('', { keyPrefix: 'views.integrationSettings' })
    const { client } = useClient()
    const stack = useStack()

    const activitypubEnabled = 'net.concrnt.activitypub.settings' in (client.server?.endpoints ?? {})
    const blueskyEnabled = 'world.concrnt.atproto.info' in (client.server?.endpoints ?? {})

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
                <List>
                    {activitypubEnabled && (
                        <ListItem
                            startIcon={<SiActivitypub size={24} />}
                            endIcon={<MdChevronRight size={24} />}
                            onClick={() => stack.push(<Activitypub />)}
                        >
                            {t('activitypub')}
                        </ListItem>
                    )}
                    {blueskyEnabled && (
                        <ListItem
                            startIcon={<SiBluesky size={24} />}
                            endIcon={<MdChevronRight size={24} />}
                            onClick={() => stack.push(<Bluesky />)}
                        >
                            {t('bluesky')}
                        </ListItem>
                    )}
                </List>
            </div>
        </View>
    )
}
