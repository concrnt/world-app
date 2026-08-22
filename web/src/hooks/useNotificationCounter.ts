import { Client } from '@concrnt/worldlib'
import { useEffect, useSyncExternalStore } from 'react'
import { usePreference } from '../contexts/Preference'

// タブバー用の未読件数。Suspense境界を置けない場所で使うため、use()でサスペンドせず
// 解決済みの値だけを読む(未解決・ゲストは0)。取得自体はvalue()で起動し、以後は
// Client.refreshFreshResources()(起動時・復帰時)とresetNotificationCounter()で更新される。
// 設定でバッジ表示を切った場合は取得もせず常に0(OSバッジも連動して消える)
export function useNotificationCounter(client: Client | null | undefined): number {
    const [badgeEnabled] = usePreference('unreadBadgeEnabled')
    const counter = badgeEnabled ? client?.notificationCounter : undefined

    useEffect(() => {
        counter?.value().catch(() => {})
    }, [counter])

    return useSyncExternalStore(
        (callback) => {
            counter?.subscribe(callback)
            return () => counter?.unsubscribe(callback)
        },
        () => counter?.current ?? 0
    )
}
