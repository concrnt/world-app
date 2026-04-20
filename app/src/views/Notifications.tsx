import { useMemo, useState } from 'react'
import { View } from '@concrnt/ui'
import { Header } from '../ui/Header'
import { NotificationTimeline } from '../components/NotificationTimeline'
import { NotificationFilter } from '../components/NotificationFilter'
import { useClient } from '../contexts/Client'
import { semantics } from '@concrnt/worldlib'

export const NotificationsView = () => {
    const { client } = useClient()

    const [selected, setSelected] = useState<string | undefined>(undefined)

    const query = useMemo(
        () => ({
            schema: selected
        }),
        [selected]
    )

    if (!client) {
        return (
            <View>
                <Header>Notifications</Header>
            </View>
        )
    }

    return (
        <View>
            <Header>Notifications</Header>
            <NotificationFilter selected={selected} setSelected={setSelected} />
            <NotificationTimeline prefix={semantics.notificationTimeline(client.ccid)} query={query} />
        </View>
    )
}
