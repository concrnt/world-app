import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { View } from '@concrnt/ui'
import { Header } from '../ui/Header'
import { NotificationTimeline, WrappedNotification } from '../components/NotificationTimeline'
import { loadNotificationSnapshot, NotificationSnapshot, saveNotificationSnapshot } from '../lib/timelineSnapshot'
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

    // 起動時スナップショット(前回表示の通知の行)。Homeと同じく、タイムラインをマウントする前にKVSから読み終えておく。
    // 保存はフィルタ無しの表示だけ、注入は起動時のフィルタ(無し)からまだ変えていない間だけ行う
    const [notificationSnapshot, setNotificationSnapshot] = useState<NotificationSnapshot | null | undefined>(undefined)
    useEffect(() => {
        if (!client) return
        let isCancelled = false
        loadNotificationSnapshot(client)
            .catch(() => null)
            .then((snapshot) => {
                if (!isCancelled) setNotificationSnapshot(snapshot)
            })
        return () => {
            isCancelled = true
        }
    }, [client])
    const [filterChanged, setFilterChanged] = useState(false)
    if (!filterChanged && selected !== undefined) {
        setFilterChanged(true)
    }
    const onHeadChange = useCallback(
        (prefix: string, query: any, rows: WrappedNotification[]) => {
            if (!client) return
            saveNotificationSnapshot(client, prefix, query, rows).catch((e) => {
                console.error('Failed to save notification snapshot:', e)
            })
        },
        [client]
    )

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
            {notificationSnapshot !== undefined && (
                <NotificationTimeline
                    ref={scrollRef}
                    prefix={semantics.notificationTimeline(client.ccid, client.currentProfile) + '/'}
                    query={query}
                    initialTimeline={filterChanged ? undefined : (notificationSnapshot ?? undefined)}
                    onHeadChange={selected === undefined ? onHeadChange : undefined}
                />
            )}
        </View>
    )
}
