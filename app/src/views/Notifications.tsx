import { useMemo, useRef, useState } from 'react'
import { View } from '@concrnt/ui'
import { Header } from '../ui/Header'
import { NotificationTimeline } from '../components/NotificationTimeline'
import { NotificationFilter } from '../components/NotificationFilter'
import { useClient } from '../contexts/Client'
import { semantics } from '@concrnt/worldlib'
import { ScrollViewHandle } from '../types/ScrollView'

export const NotificationsView = () => {
    const { client } = useClient()

    const scrollRef = useRef<ScrollViewHandle>(null)

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
            <Header onTitleTap={() => scrollRef.current?.scrollToTop()}>Notifications</Header>
            <NotificationFilter selected={selected} setSelected={setSelected} />
            <NotificationTimeline
                ref={scrollRef}
                prefix={semantics.notificationTimeline(client.ccid, client.currentProfile) + '/'}
                query={query}
            />
        </View>
    )
}
