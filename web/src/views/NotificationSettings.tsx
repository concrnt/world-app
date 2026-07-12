import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button, Checkbox, Divider, Switch, Text } from '@concrnt/ui'
import { NotFoundError, NotificationSubscription } from '@concrnt/client'
import { Schemas } from '@concrnt/worldlib'
import { useClient } from '../contexts/Client'
import { Header } from '../components/Header'
import { View } from '../components/View'
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

const schemaOptions: { labelKey: string; schema: string }[] = [
    { labelKey: 'reply', schema: Schemas.replyAssociation },
    { labelKey: 'mention', schema: Schemas.mentionAssociation },
    { labelKey: 'reroute', schema: Schemas.rerouteAssociation },
    { labelKey: 'fav', schema: Schemas.likeAssociation },
    { labelKey: 'reaction', schema: Schemas.reactionAssociation },
    { labelKey: 'readRequest', schema: Schemas.readAccessRequestAssociation },
    { labelKey: 'follow', schema: Schemas.followAck }
]

export const NotificationSettingsView = () => {
    const { t } = useTranslation('', { keyPrefix: 'views.notificationSettings' })
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
            // Only surface the browser-permission notice for an actual
            // permission denial — other failures (network/registration) show `error`.
            setPermissionDenied(msg === PUSH_PERMISSION_DENIED_MESSAGE)
        } finally {
            setBusy(false)
        }
    }

    return (
        <View>
            <Header>{t('title')}</Header>
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
                    <Text variant="h3">{t('enablePush')}</Text>
                    <Switch checked={enabled} disabled={busy} onChange={handleToggle} />
                </div>

                <Text variant="caption">{t('singleDeviceNote')}</Text>

                {permissionDenied && (
                    <Text variant="caption" style={{ color: 'var(--error, #f44336)' }}>
                        {t('permissionDeniedWeb')}
                    </Text>
                )}
                {error && (
                    <Text variant="caption" style={{ color: 'var(--error, #f44336)' }}>
                        {error}
                    </Text>
                )}

                <Divider />

                <Text variant="h3">{t('types.title')}</Text>
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
                            <Text>{t(`types.${opt.labelKey}`)}</Text>
                        </div>
                    ))}
                </div>

                <Divider />

                <Text variant="h3">{t('subscription.title')}</Text>
                {subscription ? (
                    <Text variant="caption">
                        {t('subscription.endpoint', { host: subscriptionEndpointHost(subscription) })}
                        <br />
                        {t('subscription.lastUpdated', { date: subscription.mdate ?? subscription.cdate ?? '-' })}
                    </Text>
                ) : (
                    <Text variant="caption">{t('subscription.notRegistered')}</Text>
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
                    {t('subscription.reRegister')}
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
