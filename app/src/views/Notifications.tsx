import { View } from '@concrnt/ui'
import { Header } from '../ui/Header'
import { QueryTimeline } from '../components/QueryTimeline'
import { useClient } from '../contexts/Client'

export const NotificationsView = () => {
    const { client } = useClient()

    return (
        <View>
            <Header>Notifications</Header>
            <QueryTimeline prefix={`cckv://${client?.ccid}/concrnt.world/main/notify-timeline/`} />
        </View>
    )
}
