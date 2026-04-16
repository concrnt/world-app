import { View } from '@concrnt/ui'
import { Header } from '../ui/Header'
import { NotificationTimeline } from '../components/NotificationTimeline'
import { useClient } from '../contexts/Client'

export const NotificationsView = () => {
    const { client } = useClient()

    return (
        <View>
            <Header>Notifications</Header>
            <NotificationTimeline prefix={`cckv://${client?.ccid}/concrnt.world/main/notify-timeline/`} />
        </View>
    )
}
