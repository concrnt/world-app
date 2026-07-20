import { Text, TextField, Button, Divider, IconButton, Switch } from '@concrnt/ui'
import { CssVar } from '../types/Theme'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useClient } from '../contexts/Client'
import { NotFoundError } from '@concrnt/client'
import { useNavigate } from 'react-router-dom'
import { Schemas } from '@concrnt/worldlib'
import { MdContentCopy, MdPlaylistAdd } from 'react-icons/md'
import { Subscription } from '../components/Subscription'
import { useDrawer } from '../contexts/Drawer'
import { View } from '../components/View'
import { Header } from '../components/Header'
import { BskyProfile, inboxKey } from '../utils/bluesky'

interface BskyEntity {
    did: string
    handle: string
    enabled: boolean
    status: string
}

interface BridgeInfo {
    pdsHost: string
    version: string
    serviceCcid: string
    entity?: BskyEntity
}

interface BskySettings {
    enabled: boolean
    listenTimelines: string[]
}

export const Bluesky = () => {
    const { t } = useTranslation('', { keyPrefix: 'views.bluesky' })
    const { client } = useClient()
    const drawer = useDrawer()
    const navigate = useNavigate()

    const [info, setInfo] = useState<BridgeInfo | undefined | null>(undefined)
    const [handleDraft, setHandleDraft] = useState('')
    const handle = handleDraft.trim().toLowerCase().replace(/^@/, '')
    const handleOk = handle.length > 0 && handle.match(/^([a-z0-9]([a-z0-9-]*[a-z0-9])?\.)+[a-z][a-z0-9-]*$/)

    const [setupError, setSetupError] = useState<string>()
    const [verifyError, setVerifyError] = useState<string>()
    const [verifying, setVerifying] = useState(false)

    const [settings, setSettings] = useState<BskySettings>()
    const [following, setFollowing] = useState<BskyProfile[]>([])

    const [lookupDraft, setLookupDraft] = useState('')

    const updateInfo = () => {
        client.api
            .callConcrntApi<BridgeInfo>(client.server.domain, 'world.concrnt.atproto.info', {})
            .then((res) => {
                setInfo(res)
            })
            .catch((err) => {
                console.log(err)
                setInfo(null)
            })
    }

    useEffect(() => {
        updateInfo()
    }, [])

    const active = info?.entity?.status === 'active'

    useEffect(() => {
        if (!active) return

        client.api
            .callConcrntApi<BskySettings>(client.server.domain, 'world.concrnt.atproto.settings', {})
            .then((res) => {
                setSettings(res)
            })
            .catch((err) => {
                console.log(err)
            })

        client.api
            .callConcrntApi<{ following: BskyProfile[] }>(client.server.domain, 'world.concrnt.atproto.following', {})
            .then((res) => {
                setFollowing(res.following ?? [])
            })
            .catch((err) => {
                console.log(err)
            })

        const inboxUri = inboxKey(client.ccid)
        client.api
            .getDocument(inboxUri)
            .then((_doc) => {})
            .catch((err) => {
                if (err instanceof NotFoundError && info?.serviceCcid) {
                    console.log('Inbox not found. creating...')
                    const document = {
                        kind: 'record' as const,
                        key: inboxUri,
                        author: client.ccid,
                        schema: Schemas.userTimeline,
                        value: {},
                        createdAt: new Date(),
                        policy: {
                            entries: [
                                {
                                    url: 'https://policy.concrnt.world/t/allow-writers.json',
                                    params: {
                                        entities: [info.serviceCcid]
                                    }
                                }
                            ]
                        }
                    }

                    client.api.commit(document)
                }
            })
    }, [active])

    return (
        <View>
            <Header>{t('title')}</Header>
            <div
                style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: CssVar.space(2),
                    padding: CssVar.space(2)
                }}
            >
                {info === undefined && <Text>{t('loading')}</Text>}
                {info === null && <Text>{t('unavailable')}</Text>}
                {info && !info.entity && (
                    <>
                        <Text>{t('enableIntro')}</Text>
                        <Text>{t('enableDescription')}</Text>
                        <Text>{t('handleLabel')}</Text>
                        <TextField
                            value={handleDraft}
                            placeholder="alice.example.com"
                            onChange={(e) => setHandleDraft(e.target.value)}
                        />
                        {setupError && <Text style={{ color: '#ff5b5b' }}>{setupError}</Text>}
                        <Button
                            disabled={!handleOk}
                            onClick={() => {
                                setSetupError(undefined)
                                client.api
                                    .callConcrntApi<BskyEntity>(
                                        client.server.domain,
                                        'world.concrnt.atproto.setup',
                                        {},
                                        {
                                            method: 'POST',
                                            body: JSON.stringify({
                                                handle
                                            })
                                        }
                                    )
                                    .then((_res) => {
                                        updateInfo()
                                    })
                                    .catch((err) => {
                                        console.log(err)
                                        setSetupError(t('setupFailed'))
                                    })
                            }}
                        >
                            {t('setup')}
                        </Button>
                    </>
                )}
                {info?.entity && info.entity.status === 'pending' && (
                    <>
                        <Text variant="h6" style={{ fontWeight: 'bold' }}>
                            {t('pendingTitle')}
                        </Text>
                        <Text>{t('pendingDescription', { handle: info.entity.handle })}</Text>
                        <Text>{t('verifyDnsInstruction')}</Text>
                        <RecordRow name={`_atproto.${info.entity.handle}`} value={`did=${info.entity.did}`} />
                        <Text>{t('verifyWellKnownInstruction')}</Text>
                        <RecordRow
                            name={`https://${info.entity.handle}/.well-known/atproto-did`}
                            value={info.entity.did}
                        />
                        <Text>{t('verifyNote')}</Text>
                        {verifyError && <Text style={{ color: '#ff5b5b' }}>{verifyError}</Text>}
                        <Button
                            disabled={verifying}
                            onClick={() => {
                                setVerifying(true)
                                setVerifyError(undefined)
                                client.api
                                    .callConcrntApi<BskyEntity>(
                                        client.server.domain,
                                        'world.concrnt.atproto.verify',
                                        {},
                                        {
                                            method: 'POST'
                                        }
                                    )
                                    .then((_res) => {
                                        updateInfo()
                                    })
                                    .catch((err) => {
                                        console.log(err)
                                        setVerifyError(t('verifyFailed'))
                                    })
                                    .finally(() => {
                                        setVerifying(false)
                                    })
                            }}
                        >
                            {t('verify')}
                        </Button>
                    </>
                )}
                {info?.entity && active && (
                    <>
                        <Text>{t('active')}</Text>
                        <Text>{t('yourHandle', { handle: info.entity.handle })}</Text>
                        <Text variant="caption">{info.entity.did}</Text>
                        {settings && (
                            <div
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between'
                                }}
                            >
                                <Text>{t('enabledToggle')}</Text>
                                <Switch
                                    checked={settings.enabled}
                                    onChange={(checked) => {
                                        client.api
                                            .callConcrntApi<BskySettings>(
                                                client.server.domain,
                                                'world.concrnt.atproto.settings',
                                                {},
                                                {
                                                    method: 'POST',
                                                    body: JSON.stringify({
                                                        enabled: checked
                                                    })
                                                }
                                            )
                                            .then((res) => {
                                                setSettings(res)
                                            })
                                            .catch((err) => {
                                                console.log(err)
                                            })
                                    }}
                                />
                            </div>
                        )}
                        <Divider />
                        <IconButton
                            onClick={(e) => {
                                e.stopPropagation()
                                drawer.open(<Subscription target={inboxKey(client.ccid)} />)
                            }}
                        >
                            <MdPlaylistAdd size={24} />
                        </IconButton>
                        {following.length > 0 && (
                            <>
                                <Text variant="h6" style={{ fontWeight: 'bold' }}>
                                    {t('following')}
                                </Text>
                                {following.map((profile) => (
                                    <div
                                        key={profile.did}
                                        onClick={() => {
                                            navigate('/bluesky/view/' + encodeURIComponent(profile.did))
                                        }}
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: CssVar.space(1),
                                            cursor: 'pointer'
                                        }}
                                    >
                                        {profile.avatar && (
                                            <img
                                                src={profile.avatar}
                                                style={{
                                                    width: '32px',
                                                    height: '32px',
                                                    borderRadius: '50%'
                                                }}
                                            />
                                        )}
                                        <Text style={{ fontWeight: 'bold' }}>
                                            {profile.displayName || profile.handle}
                                        </Text>
                                        <Text variant="caption">@{profile.handle}</Text>
                                    </div>
                                ))}
                                <Divider />
                            </>
                        )}
                        <TextField
                            value={lookupDraft}
                            placeholder="alice.bsky.social / at://..."
                            onChange={(e) => setLookupDraft(e.target.value)}
                        />
                        <Button
                            onClick={() => {
                                navigate('/bluesky/view/' + encodeURIComponent(lookupDraft))
                            }}
                        >
                            {t('inquiry')}
                        </Button>
                    </>
                )}
            </div>
        </View>
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
            <div
                style={{
                    flex: 1,
                    minWidth: 0
                }}
            >
                <Text
                    variant="caption"
                    style={{
                        wordBreak: 'break-all'
                    }}
                >
                    {name}
                </Text>
                <Text
                    style={{
                        fontFamily: 'monospace',
                        wordBreak: 'break-all'
                    }}
                >
                    {value}
                </Text>
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
