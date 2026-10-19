import { View, Text, TextField, Button, Divider, IconButton, Switch } from '@concrnt/ui'
import { Header } from '../ui/Header'
import { CssVar } from '../types/Theme'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useClient } from '../contexts/Client'
import { useStack } from '../layouts/Stack'
import { BskyView } from './BskyView'
import { NotFoundError } from '@concrnt/client'
import { Schemas, semantics } from '@concrnt/worldlib'
import { MdContentCopy, MdPlaylistAdd } from 'react-icons/md'
import { Subscription } from '../components/Subscription'
import { BskyFollowList } from '../components/BskyFollowList'
import { Drawer } from '../ui/Drawer'
import { Confirm } from '../components/Confirm'
import { TimelinePicker } from '../components/TimelinePicker'
import { CompositeSearchProvider, KnownCommunitySearchProvider, StaticSearchProvider } from '../lib/timelineSearch'
import { bskySettingsKey, inboxKey } from '../utils/bluesky'

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
    // 公式Blueskyアプリのログイン画面に入れる値(ブリッジが組み立てる)
    login?: { service: string; identifier: string }
}

// ブリッジが発行する、公式Blueskyアプリ用のログイン資格情報(平文は発行時の応答にしか無い)
interface AppPassword {
    id: string
    name: string
    createdAt: string
    lastUsedAt?: string
}

export const Bluesky = () => {
    const { t } = useTranslation('', { keyPrefix: 'views.bluesky' })
    const { client } = useClient()
    const [subscriptionOpen, setSubscriptionOpen] = useState(false)
    const stack = useStack()

    const [info, setInfo] = useState<BridgeInfo | undefined | null>(undefined)
    const [handleDraft, setHandleDraft] = useState('')
    const handle = handleDraft.trim().toLowerCase().replace(/^@/, '')
    const handleOk = handle.length > 0 && handle.match(/^([a-z0-9]([a-z0-9-]*[a-z0-9])?\.)+[a-z][a-z0-9-]*$/)

    const [setupError, setSetupError] = useState<string>()
    const [verifyError, setVerifyError] = useState<string>()
    const [verifying, setVerifying] = useState(false)
    const [announcing, setAnnouncing] = useState(false)
    const [announceResult, setAnnounceResult] = useState<'done' | 'failed'>()

    // ユーザー設定はブリッジが直接読むcckvレコードが正本(APブリッジと同型)。
    // enabled + 転送元タイムライン(ホーム+コミュニティ複数選択、未設定はホームにフォールバック)。
    const [bridgeEnabled, setBridgeEnabled] = useState(true)
    const [listenHome, setListenHome] = useState(true)
    // 転送先の候補: リスト未登録だとknownCommunitiesに現れない自分のinboxを常に先頭に出し、
    // 続けてブリッジ由来以外の登録済みコミュニティを並べる(crawlerのグローバル検索は使わない)
    const forwardProvider = useMemo(
        () =>
            new CompositeSearchProvider([
                new StaticSearchProvider([{ uri: inboxKey(client.ccid), name: 'Bluesky', known: false }]),
                new KnownCommunitySearchProvider(client, (tl) => !tl.uri.includes('/atproto.concrnt.world/'))
            ]),
        [client]
    )
    const [listenProfile, setListenProfile] = useState('main')
    const [listenCommunities, setListenCommunities] = useState<string[]>([])

    const homeTimelineRegex = new RegExp(`^cckv://${client.ccid}/concrnt\\.world/profiles/([^/]+)/home-timeline$`)

    const commitSettings = (enabled: boolean) => {
        const listenTimelines = [
            ...(listenHome ? [semantics.homeTimeline(client.ccid, listenProfile)] : []),
            ...listenCommunities
        ]
        client.api
            .commit({
                kind: 'record' as const,
                key: bskySettingsKey(client.ccid),
                author: client.ccid,
                schema: Schemas.atprotoSettings,
                value: { listenTimelines, enabled },
                createdAt: new Date()
            })
            .catch((err) => {
                console.log(err)
            })
    }

    const [lookupDraft, setLookupDraft] = useState('')

    // 公式Blueskyアプリ用アプリパスワード(DM閲覧用。投稿・いいね等はブリッジ側が拒否する)
    const [appPasswords, setAppPasswords] = useState<AppPassword[] | undefined>(undefined)
    const [appPasswordName, setAppPasswordName] = useState('')
    const [appPasswordCreating, setAppPasswordCreating] = useState(false)
    const [appPasswordError, setAppPasswordError] = useState<string>()
    const [issuedAppPassword, setIssuedAppPassword] = useState<{ name: string; password: string }>()
    const [revokeTarget, setRevokeTarget] = useState<AppPassword>()

    const loadAppPasswords = () => {
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

    const createAppPassword = () => {
        const name = appPasswordName.trim()
        if (!name) return
        setAppPasswordCreating(true)
        setAppPasswordError(undefined)
        client.api
            .callConcrntApi<AppPassword & { password: string }>(
                client.server.domain,
                'world.concrnt.atproto.createAppPassword',
                {},
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name })
                }
            )
            .then((res) => {
                setIssuedAppPassword({ name: res.name, password: res.password })
                setAppPasswordName('')
                loadAppPasswords()
            })
            .catch((err) => {
                console.log(err)
                setAppPasswordError(t('appPasswordCreateFailed'))
            })
            .finally(() => {
                setAppPasswordCreating(false)
            })
    }

    const revokeAppPassword = () => {
        const target = revokeTarget
        if (!target) return
        setRevokeTarget(undefined)
        setAppPasswordError(undefined)
        client.api
            .callConcrntApi(
                client.server.domain,
                'world.concrnt.atproto.revokeAppPassword',
                { id: target.id },
                { method: 'DELETE' }
            )
            .then(() => {
                if (issuedAppPassword?.name === target.name) setIssuedAppPassword(undefined)
                loadAppPasswords()
            })
            .catch((err) => {
                console.log(err)
                setAppPasswordError(t('appPasswordRevokeFailed'))
            })
    }

    const appPasswordSupported = 'world.concrnt.atproto.appPasswords' in (client.server?.endpoints ?? {})

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

        if (appPasswordSupported) loadAppPasswords()

        client.api
            .getDocument<{ listenTimelines: string[]; enabled?: boolean }>(bskySettingsKey(client.ccid))
            .then((doc) => {
                const timelines = doc.value?.listenTimelines ?? []
                const homeProfile = timelines.map((uri) => uri.match(homeTimelineRegex)?.[1]).find((m) => m)
                setListenHome(timelines.length === 0 || homeProfile !== undefined)
                if (homeProfile) setListenProfile(homeProfile)
                setListenCommunities(timelines.filter((uri) => !homeTimelineRegex.test(uri)))
                setBridgeEnabled(doc.value?.enabled ?? true)
            })
            .catch((err) => {
                if (!(err instanceof NotFoundError)) console.log(err)
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
                    flex: 1,
                    overflowY: 'auto',
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
                                            headers: { 'Content-Type': 'application/json' },
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
                        <div
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between'
                            }}
                        >
                            <Text>{t('enabledToggle')}</Text>
                            <Switch
                                checked={bridgeEnabled}
                                onChange={(checked) => {
                                    setBridgeEnabled(checked)
                                    commitSettings(checked)
                                }}
                            />
                        </div>
                        <Divider />
                        <Text>{t('forwardTimeline')}</Text>
                        <Text>{t('forwardTimelineDesc')}</Text>
                        <TimelinePicker
                            provider={forwardProvider}
                            selected={listenCommunities}
                            setSelected={setListenCommunities}
                            postHome={listenHome}
                            setPostHome={setListenHome}
                            selectedProfile={listenProfile}
                            setSelectedProfile={setListenProfile}
                        />
                        <Button onClick={() => commitSettings(bridgeEnabled)}>{t('update')}</Button>
                        <Divider />
                        <Text>{t('announceDesc')}</Text>
                        {announceResult === 'done' && <Text variant="caption">{t('announceDone')}</Text>}
                        {announceResult === 'failed' && <Text style={{ color: '#ff5b5b' }}>{t('announceFailed')}</Text>}
                        <Button
                            disabled={announcing}
                            onClick={() => {
                                setAnnouncing(true)
                                setAnnounceResult(undefined)
                                client.api
                                    .callConcrntApi<BskyEntity>(
                                        client.server.domain,
                                        'world.concrnt.atproto.announce',
                                        {},
                                        {
                                            method: 'POST'
                                        }
                                    )
                                    .then(() => {
                                        setAnnounceResult('done')
                                    })
                                    .catch((err) => {
                                        console.log(err)
                                        setAnnounceResult('failed')
                                    })
                                    .finally(() => {
                                        setAnnouncing(false)
                                    })
                            }}
                        >
                            {t('announce')}
                        </Button>
                        {appPasswordSupported && (
                            <>
                                <Divider />
                                <Text variant="h6" style={{ fontWeight: 'bold' }}>
                                    {t('appPasswordTitle')}
                                </Text>
                                <Text>{t('appPasswordDesc')}</Text>
                                <Text variant="caption">{t('appPasswordLimits')}</Text>
                                {info.login && (
                                    <>
                                        <RecordRow name={t('appPasswordService')} value={info.login.service} />
                                        <RecordRow name={t('appPasswordIdentifier')} value={info.login.identifier} />
                                    </>
                                )}
                                {appPasswords === undefined && <Text variant="caption">{t('loading')}</Text>}
                                {appPasswords && appPasswords.length === 0 && (
                                    <Text variant="caption">{t('appPasswordEmpty')}</Text>
                                )}
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
                                                {t('appPasswordCreatedAt', {
                                                    date: new Date(ap.createdAt).toLocaleDateString()
                                                })}
                                                {' / '}
                                                {ap.lastUsedAt
                                                    ? t('appPasswordLastUsed', {
                                                          date: new Date(ap.lastUsedAt).toLocaleDateString()
                                                      })
                                                    : t('appPasswordNeverUsed')}
                                            </Text>
                                        </div>
                                        <Button variant="outlined" onClick={() => setRevokeTarget(ap)}>
                                            {t('appPasswordRevoke')}
                                        </Button>
                                    </div>
                                ))}
                                <div style={{ display: 'flex', gap: CssVar.space(1), alignItems: 'center' }}>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <TextField
                                            value={appPasswordName}
                                            placeholder={t('appPasswordNamePlaceholder')}
                                            onChange={(e) => setAppPasswordName(e.target.value)}
                                        />
                                    </div>
                                    <Button
                                        disabled={appPasswordCreating || appPasswordName.trim().length === 0}
                                        onClick={createAppPassword}
                                    >
                                        {t('appPasswordCreate')}
                                    </Button>
                                </div>
                                {appPasswordError && <Text style={{ color: '#ff5b5b' }}>{appPasswordError}</Text>}
                                {issuedAppPassword && (
                                    <>
                                        <Text>{t('appPasswordIssued', { name: issuedAppPassword.name })}</Text>
                                        <RecordRow name={t('appPasswordLabel')} value={issuedAppPassword.password} />
                                        <Text variant="caption">{t('appPasswordIssuedNote')}</Text>
                                    </>
                                )}
                                <Confirm
                                    open={revokeTarget !== undefined}
                                    onClose={() => setRevokeTarget(undefined)}
                                    title={t('appPasswordRevokeConfirmTitle')}
                                    description={t('appPasswordRevokeConfirmDescription', {
                                        name: revokeTarget?.name ?? ''
                                    })}
                                    confirmText={t('appPasswordRevoke')}
                                    onConfirm={revokeAppPassword}
                                />
                            </>
                        )}
                        <Divider />
                        <IconButton
                            onClick={(e) => {
                                e.stopPropagation()
                                setSubscriptionOpen(true)
                            }}
                        >
                            <MdPlaylistAdd size={24} />
                        </IconButton>
                        <Drawer open={subscriptionOpen} onClose={() => setSubscriptionOpen(false)}>
                            <Subscription target={inboxKey(client.ccid)} />
                        </Drawer>
                        <TextField
                            value={lookupDraft}
                            placeholder="alice.bsky.social / at://..."
                            onChange={(e) => setLookupDraft(e.target.value)}
                        />
                        <Button
                            onClick={() => {
                                stack.push(<BskyView uri={lookupDraft} />)
                            }}
                        >
                            {t('inquiry')}
                        </Button>
                        <Divider />
                        <BskyFollowList />
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
