import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { useRegisterSW } from 'virtual:pwa-register/react'
import { Button, Text } from '@concrnt/ui'
import { useClient } from '../contexts/Client'
import { getPushSchemas, isPushEnabled, registerPush } from '../lib/push'

// PWAまわりの雑務をまとめて引き受けるコンポーネント:
// - 新バージョン検知時の更新バナー表示
// - 通知クリック時のservice workerからのnavigateメッセージ処理
// - 起動時のプッシュ購読の再登録(upsert)
export const PwaManager = () => {
    const { t } = useTranslation('', { keyPrefix: 'web.pwaManager' })
    const { client } = useClient()
    const navigate = useNavigate()

    const {
        needRefresh: [needRefresh],
        updateServiceWorker
    } = useRegisterSW({
        onRegisteredSW(_swUrl, registration) {
            if (!registration) return
            setInterval(
                () => {
                    registration.update()
                },
                10 * 60 * 1000
            )
        }
    })

    // 通知クリック時、既存タブがあればservice workerがnavigateメッセージを送ってくる
    useEffect(() => {
        if (!('serviceWorker' in navigator)) return
        const onMessage = (event: MessageEvent) => {
            if (event.data?.type === 'navigate' && typeof event.data.url === 'string') {
                navigate(event.data.url)
            }
        }
        navigator.serviceWorker.addEventListener('message', onMessage)
        return () => {
            navigator.serviceWorker.removeEventListener('message', onMessage)
        }
    }, [navigate])

    // Push notifications: re-upsert the subscription on every app start (the
    // cheapest way to keep the subscription fresh across VAPID key changes and
    // profile switches).
    useEffect(() => {
        if (!client?.ccid) return
        if (!isPushEnabled()) return
        registerPush(client, getPushSchemas()).catch((err) => {
            console.error('failed to re-register push subscription', err)
        })
    }, [client])

    if (!needRefresh) return null

    return (
        <div
            style={{
                width: '100%',
                boxSizing: 'border-box',
                backgroundColor: '#0476d9',
                color: '#ffffff',
                padding: '6px 8px',
                textAlign: 'center',
                flexShrink: 0,
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                gap: '8px'
            }}
        >
            <Text variant="caption" style={{ color: '#ffffff', margin: 0 }}>
                {t('newVersionAvailable')}
            </Text>
            <Button
                variant="text"
                style={{ color: '#ffffff', minHeight: 0, padding: '2px 8px' }}
                onClick={() => {
                    updateServiceWorker(true)
                }}
            >
                {t('update')}
            </Button>
        </div>
    )
}
