import { useCallback, useSyncExternalStore } from 'react'
import { DomainStatus, ONLINE_STATUS } from '@concrnt/worldlib'
import { useClient } from '../contexts/Client'

// ドメイン(ホスト)のオンライン状態を購読する。hostを省略すると自ドメイン(投稿先・自分のリソースの置き場)。
// 復帰時の再試行はonlineSince(最後にonlineへ遷移した時刻)をresetKeys/effectの依存にして行う。
// 「どのドメインが必要か」は呼び出し側が決める: 投稿セルは失敗したServerOfflineError.host、
// タイムラインは購読先ホスト、プロフィール画面はそのユーザーのドメイン
export function useDomainStatus(host?: string): DomainStatus {
    const { client } = useClient()
    const subscribe = useCallback(
        (callback: () => void) => {
            // Contextの既定値({} as Client)の下ではClientが無い
            if (typeof client.subscribeDomainStatus !== 'function') return () => {}
            client.subscribeDomainStatus(callback)
            return () => {
                client.unsubscribeDomainStatus(callback)
            }
        },
        [client]
    )
    return useSyncExternalStore(subscribe, () => {
        if (typeof client.getDomainStatus !== 'function') return ONLINE_STATUS
        return client.getDomainStatus(host ?? client.api.defaultHost)
    })
}
