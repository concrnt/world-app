import { useEffect, useMemo, useRef, useState } from 'react'
import { View } from '@concrnt/ui'
import { Header } from '../ui/Header'
import { NotificationTimeline } from '../components/NotificationTimeline'
import { NotificationFilter } from '../components/NotificationFilter'
import { useClient } from '../contexts/Client'
import { semantics } from '@concrnt/worldlib'
import { ScrollViewHandle } from '../types/ScrollView'
import { useActivity } from '../contexts/Activity'
import { setAppBadge } from '../lib/push'

export const NotificationsView = () => {
    const { client } = useClient()

    const scrollRef = useRef<ScrollViewHandle>(null)

    const [selected, setSelected] = useState<string | undefined>(undefined)

    // 通知画面が見えた=全部見たとみなして未読を0に戻す(タブ選択・pushディープリンク・
    // 表示中のアプリ復帰すべてここで拾う)。OSのアイコンバッジも同時に消す
    const activity = useActivity()
    useEffect(() => {
        if (!client || activity !== 'visible') return
        const clear = () => {
            if (document.visibilityState !== 'visible') return
            client.resetNotificationCounter()
            setAppBadge(0)
        }
        clear()
        document.addEventListener('visibilitychange', clear)
        return () => document.removeEventListener('visibilitychange', clear)
    }, [client, activity])

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
