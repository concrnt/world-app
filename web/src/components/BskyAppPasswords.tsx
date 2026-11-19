import { Text, TextField, Button, IconButton, Confirm } from '@concrnt/ui'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { MdContentCopy } from 'react-icons/md'
import { useClient } from '../contexts/Client'
import { CssVar } from '../types/Theme'

// ブリッジが発行する、Bluesky公式アプリ等からこのアカウントにログインするための資格情報
// (平文は発行時の応答にしか無い)。投稿・いいね等はブリッジ側が拒否するので、他アプリからは閲覧とDMだけ。
interface AppPassword {
    id: string
    name: string
    createdAt: string
    lastUsedAt?: string
}

interface Props {
    // 公式アプリのログイン画面に入れる値(ブリッジの info が返す)
    login?: { service: string; identifier: string }
}

export const BskyAppPasswords = (props: Props) => {
    const { t } = useTranslation('', { keyPrefix: 'components.bskyAppPasswords' })
    const { client } = useClient()

    const [appPasswords, setAppPasswords] = useState<AppPassword[] | undefined>(undefined)
    const [name, setName] = useState('')
    const [creating, setCreating] = useState(false)
    const [error, setError] = useState<string>()
    const [issued, setIssued] = useState<{ name: string; password: string }>()
    const [revokeTarget, setRevokeTarget] = useState<AppPassword>()

    const load = () => {
        client.api
            .callConcrntApi<{ appPasswords: AppPassword[] }>(
                client.server.domain,
                'world.concrnt.atproto.appPasswords',
                {}
            )
            .then((res) => {
                setAppPasswords(res.appPasswords ?? [])
            })
            .catch((err) => {
                console.log(err)
                setAppPasswords([])
            })
    }

    // ドロワーが開くたびにマウントされるので、その都度最新を取る
    useEffect(() => {
        load()
    }, [])

    const create = () => {
        const trimmed = name.trim()
        if (!trimmed) return
        setCreating(true)
        setError(undefined)
        client.api
            .callConcrntApi<AppPassword & { password: string }>(
                client.server.domain,
                'world.concrnt.atproto.createAppPassword',
                {},
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name: trimmed })
                }
            )
            .then((res) => {
                setIssued({ name: res.name, password: res.password })
                setName('')
                load()
            })
            .catch((err) => {
                console.log(err)
                setError(t('issueFailed'))
            })
            .finally(() => {
                setCreating(false)
            })
    }

    const revoke = () => {
        const target = revokeTarget
        if (!target) return
        setRevokeTarget(undefined)
        setError(undefined)
        client.api
            .callConcrntApi(
                client.server.domain,
                'world.concrnt.atproto.revokeAppPassword',
                { id: target.id },
                { method: 'DELETE' }
            )
            .then(() => {
                if (issued?.name === target.name) setIssued(undefined)
                load()
            })
            .catch((err) => {
                console.log(err)
                setError(t('revokeFailed'))
            })
    }

    return (
        <div
            style={{
                display: 'flex',
                flexDirection: 'column',
                gap: CssVar.space(2),
                padding: `${CssVar.space(2)} 0`
            }}
        >
            <Text variant="h3">{t('title')}</Text>
            {props.login && (
                <>
                    <RecordRow name={t('serviceLabel')} value={props.login.service} />
                    <RecordRow name={t('identifierLabel')} value={props.login.identifier} />
                </>
            )}
            <div style={{ display: 'flex', gap: CssVar.space(1), alignItems: 'center' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                    <TextField
                        value={name}
                        placeholder={t('namePlaceholder')}
                        onChange={(e) => setName(e.target.value)}
                    />
                </div>
                <Button disabled={creating || name.trim().length === 0} onClick={create}>
                    {t('issue')}
                </Button>
            </div>
            {error && <Text style={{ color: '#ff5b5b' }}>{error}</Text>}
            {issued && (
                <>
                    <Text>{t('issued', { name: issued.name })}</Text>
                    <RecordRow name={t('passwordLabel')} value={issued.password} />
                    <Text variant="caption">{t('issuedNote')}</Text>
                </>
            )}
            <Text variant="h6">{t('issuedHeading')}</Text>
            {appPasswords === undefined && <Text variant="caption">{t('loading')}</Text>}
            {appPasswords && appPasswords.length === 0 && <Text variant="caption">{t('empty')}</Text>}
            {appPasswords?.map((ap) => (
                <div
                    key={ap.id}
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: CssVar.space(1),
                        border: `1px solid ${CssVar.divider}`,
                        borderRadius: '8px',
                        padding: CssVar.space(1)
                    }}
                >
                    <div style={{ flex: 1, minWidth: 0 }}>
                        <Text style={{ wordBreak: 'break-all' }}>{ap.name}</Text>
                        <Text variant="caption">
                            {t('createdAt', { date: new Date(ap.createdAt).toLocaleDateString() })}
                            {' / '}
                            {ap.lastUsedAt
                                ? t('lastUsed', { date: new Date(ap.lastUsedAt).toLocaleDateString() })
                                : t('neverUsed')}
                        </Text>
                    </div>
                    <Button variant="outlined" onClick={() => setRevokeTarget(ap)}>
                        {t('revoke')}
                    </Button>
                </div>
            ))}
            <Confirm
                open={revokeTarget !== undefined}
                onClose={() => setRevokeTarget(undefined)}
                title={t('revokeConfirmTitle')}
                description={t('revokeConfirmDescription', { name: revokeTarget?.name ?? '' })}
                confirmText={t('revoke')}
                onConfirm={revoke}
            />
        </div>
    )
}

const RecordRow = ({ name, value }: { name: string; value: string }) => {
    return (
        <div
            style={{
                display: 'flex',
                alignItems: 'center',
                gap: CssVar.space(1),
                border: `1px solid ${CssVar.divider}`,
                borderRadius: '8px',
                padding: CssVar.space(1)
            }}
        >
            <div style={{ flex: 1, minWidth: 0 }}>
                <Text variant="caption" style={{ wordBreak: 'break-all' }}>
                    {name}
                </Text>
                <Text style={{ fontFamily: 'monospace', wordBreak: 'break-all' }}>{value}</Text>
            </div>
            <IconButton
                onClick={() => {
                    navigator.clipboard.writeText(value)
                }}
            >
                <MdContentCopy size={20} />
            </IconButton>
        </div>
    )
}
