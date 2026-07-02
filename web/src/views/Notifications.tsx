import { useMemo, useRef, useState } from 'react'
import { NotificationTimeline } from '../components/NotificationTimeline'
import { NotificationFilter } from '../components/NotificationFilter'
import { useClient } from '../contexts/Client'
import { semantics } from '@concrnt/worldlib'
import { ScrollViewHandle } from '../types/ScrollView'
import { View } from '../components/View'
import { Header } from '../components/Header'
import { Text } from '@concrnt/ui'
import { CssVar } from '../types/Theme'

export const NotificationsView = () => {
    const { client, offlineDomain } = useClient()

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

    if (offlineDomain) {
        return (
            <View>
                <Header>Notifications</Header>
                <div
                    style={{
                        padding: CssVar.space(4),
                        display: 'flex',
                        flexDirection: 'column',
                        gap: CssVar.space(1)
                    }}
                >
                    <Text variant="h3">通知を読み込めません</Text>
                    <Text style={{ opacity: 0.7 }}>
                        自分のドメインがオフラインのため、通知タイムラインを取得できません。
                    </Text>
                </div>
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
