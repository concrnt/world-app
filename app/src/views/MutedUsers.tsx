import { View, Text } from '@concrnt/ui'
import { useTranslation } from 'react-i18next'
import { usePreference } from '../contexts/Preference'
import { CssVar } from '../types/Theme'
import { Header } from '../ui/Header'
import { CCUserChip } from '../components/CCUserChip'

export const MutedUsersView = () => {
    const { t } = useTranslation('', { keyPrefix: 'views.mutedUsers' })
    const [mutedUsers, setMutedUsers] = usePreference('mutedUsers')

    return (
        <View>
            <Header>{t('title')}</Header>
            <div
                style={{
                    flex: 1,
                    overflowY: 'auto',
                    touchAction: 'pan-y',
                    display: 'flex',
                    flexWrap: 'wrap',
                    alignContent: 'flex-start',
                    gap: CssVar.space(2),
                    padding: CssVar.space(4)
                }}
            >
                {mutedUsers.length === 0 && <Text style={{ color: CssVar.contentTextDim }}>{t('empty')}</Text>}
                {mutedUsers.map((ccid) => (
                    <CCUserChip
                        key={ccid}
                        ccid={ccid}
                        avatar
                        onDelete={() => setMutedUsers(mutedUsers.filter((e) => e !== ccid))}
                    />
                ))}
            </div>
        </View>
    )
}
