import { useEffect, useState } from 'react'
import { Button, Checkbox, Divider, Switch, Text, View } from '@concrnt/ui'
import { NotFoundError, NotificationSubscription } from '@concrnt/client'
import { Schemas } from '@concrnt/worldlib'
import { useClient } from '../contexts/Client'
import { Header } from '../ui/Header'
import { CssVar } from '../types/Theme'
import {
    checkPushPermission,
    DEFAULT_PUSH_SCHEMAS,
    getPushSchemas,
    isPushEnabled,
    PUSH_PERMISSION_DENIED_MESSAGE,
    PUSH_VENDOR_ID,
    registerPush,
    unregisterPush
} from '../lib/push'

const schemaOptions: { label: string; schema: string }[] = [
    { label: 'リプライ', schema: Schemas.replyAssociation },
    { label: 'メンション', schema: Schemas.mentionAssociation },
    { label: 'リルート', schema: Schemas.rerouteAssociation },
    { label: 'お気に入り', schema: Schemas.likeAssociation },
    { label: 'リアクション', schema: Schemas.reactionAssociation },
    { label: '閲覧リクエスト', schema: Schemas.readAccessRequestAssociation },
    { label: 'フォロー', schema: Schemas.followAck }
]

export const NotificationSettingsView = () => {
    const { client } = useClient()

    const [enabled, setEnabled] = useState(isPushEnabled)
    const [schemas, setSchemas] = useState<string[]>(getPushSchemas)
    const [permissionDenied, setPermissionDenied] = useState(false)
    const [busy, setBusy] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [subscription, setSubscription] = useState<NotificationSubscription | null>(null)

    useEffect(() => {
        checkPushPermission()
            .then((r) => setPermissionDenied(r.status === 'denied'))
            .catch(() => {})
    }, [])

    useEffect(() => {
        client.api
            .getNotificationSubscription(client.ccid, PUSH_VENDOR_ID)
            .then(setSubscription)
            .catch((err) => {
                if (!(err instanceof NotFoundError)) console.error('failed to fetch notification subscription', err)
                setSubscription(null)
            })
    }, [client, enabled])

    const applySchemas = async (next: string[]) => {
        setSchemas(next)
        if (!enabled) return
        setBusy(true)
        setError(null)
        try {
            await registerPush(client, next)
        } catch (e) {
            setError(e instanceof Error ? e.message : String(e))
        } finally {
            setBusy(false)
        }
    }

    const handleToggle = async (next: boolean) => {
        setBusy(true)
        setError(null)
        try {
            if (next) {
                await registerPush(client, schemas)
                setEnabled(true)
            } else {
                await unregisterPush(client)
                setEnabled(false)
            }
        } catch (e) {
            const msg = e instanceof Error ? e.message : String(e)
            setError(msg)
            // Only surface the OS-permission notice for an actual permission
            // denial — other failures (relay/network/registration) show `error`.
            setPermissionDenied(msg === PUSH_PERMISSION_DENIED_MESSAGE)
        } finally {
            setBusy(false)
        }
    }

    return (
        <View>
            <Header>通知</Header>
            <div
                style={{
                    flex: 1,
                    overflowY: 'auto',
                    touchAction: 'pan-y',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: CssVar.space(4),
                    padding: CssVar.space(4)
                }}
            >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Text variant="h3">プッシュ通知を受け取る</Text>
                    <Switch checked={enabled} disabled={busy} onChange={handleToggle} />
                </div>

                {permissionDenied && (
                    <Text variant="caption" style={{ color: 'var(--error, #f44336)' }}>
                        通知の許可がOS側で拒否されています。端末の設定アプリからこのアプリの通知を許可してください。
                    </Text>
                )}
                {error && (
                    <Text variant="caption" style={{ color: 'var(--error, #f44336)' }}>
                        {error}
                    </Text>
                )}

                <Divider />

                <Text variant="h3">通知の種類</Text>
                <div style={{ display: 'flex', flexDirection: 'column', gap: CssVar.space(2) }}>
                    {schemaOptions.map((opt) => (
                        <div key={opt.schema} style={{ display: 'flex', alignItems: 'center', gap: CssVar.space(2) }}>
                            <Checkbox
                                checked={schemas.includes(opt.schema)}
                                onChange={(checked) => {
                                    const next = checked
                                        ? [...schemas, opt.schema]
                                        : schemas.filter((s) => s !== opt.schema)
                                    applySchemas(next)
                                }}
                            />
                            <Text>{opt.label}</Text>
                        </div>
                    ))}
                </div>

                <Divider />

                <Text variant="h3">購読状況</Text>
                {subscription ? (
                    <Text variant="caption">
                        エンドポイント: {subscriptionEndpointHost(subscription)}
                        <br />
                        最終更新: {subscription.mdate ?? subscription.cdate ?? '-'}
                    </Text>
                ) : (
                    <Text variant="caption">未登録です</Text>
                )}
                <Button
                    disabled={busy}
                    onClick={async () => {
                        setBusy(true)
                        setError(null)
                        try {
                            await registerPush(client, schemas.length > 0 ? schemas : DEFAULT_PUSH_SCHEMAS)
                            setEnabled(true)
                        } catch (e) {
                            setError(e instanceof Error ? e.message : String(e))
                        } finally {
                            setBusy(false)
                        }
                    }}
                >
                    再登録
                </Button>
            </div>
        </View>
    )
}

function subscriptionEndpointHost(subscription: NotificationSubscription): string {
    try {
        return new URL(JSON.parse(subscription.subscription).endpoint).host
    } catch {
        return '-'
    }
}
