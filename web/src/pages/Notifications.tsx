import { useMemo, useState } from 'react'
import { View } from '@concrnt/ui'
import { semantics } from '@concrnt/worldlib'
import { NotificationFilter } from '../components/NotificationFilter'
import { QueryTimeline } from '../components/QueryTimeline'
import { useClient } from '../contexts/Client'
import { Header } from '../ui/Header'

export const Notifications = () => {
    const { client } = useClient()
    const [selected, setSelected] = useState<string | undefined>(undefined)

    const query = useMemo(() => {
        return selected ? { schema: selected } : undefined
    }, [selected])

    if (!client) return null

    return (
        <View
            style={{
                margin: 0,
                height: '100%',
                minHeight: 0
            }}
        >
            <Header>Notifications</Header>
            <NotificationFilter selected={selected} setSelected={setSelected} />
            <QueryTimeline
                prefix={`${semantics.notificationTimeline(client.ccid, client.currentProfile)}/`}
                query={query}
                emptyLabel="通知はまだありません。"
            />
        </View>
    )
}
