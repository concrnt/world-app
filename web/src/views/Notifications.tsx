import { useEffect, useMemo, useRef, useState } from 'react'
import { NotificationTimeline } from '../components/NotificationTimeline'
import { NotificationFilter } from '../components/NotificationFilter'
import { useClient } from '../contexts/Client'
import { semantics } from '@concrnt/worldlib'
import { ScrollViewHandle } from '../types/ScrollView'
import { View } from '../components/View'
import { Header } from '../components/Header'
import { setAppBadge } from '../lib/push'

export const NotificationsView = () => {
    const { client } = useClient()

    const scrollRef = useRef<ScrollViewHandle>(null)

    const [selected, setSelected] = useState<string | undefined>(undefined)

    // 通知画面を開いた=全部見たとみなして未読を0に戻す。表示中のタブ復帰でも再クリア。
    // インストール済みPWAのアイコンバッジも同時に消す
    useEffect(() => {
        if (!client) return
        const clear = () => {
            if (document.visibilityState !== 'visible') return
            client.resetNotificationCounter()
            setAppBadge(0)
        }
        clear()
        document.addEventListener('visibilitychange', clear)
        return () => document.removeEventListener('visibilitychange', clear)
    }, [client])

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
