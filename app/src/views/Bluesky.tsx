import { View, Text, TextField, Button, Divider, IconButton, Switch, Hint } from '@concrnt/ui'
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
import { BskyAppPasswords } from '../components/BskyAppPasswords'
import { Drawer } from '../ui/Drawer'
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
    // pending のまま別のドメインに差し替える編集中(ブリッジは同じ DID で handle だけ更新する)
    const [editingHandle, setEditingHandle] = useState(false)
    const [verifyError, setVerifyError] = useState<string>()
    const [verifying, setVerifying] = useState(false)
    const [announcing, setAnnouncing] = useState(false)
    const [announceResult, setAnnounceResult] = useState<'done' | 'failed'>()
    // active のまま別のドメインへ移す編集中(ブリッジは新ドメインの DNS を検証してから PLC を更新する)
    const [changingHandle, setChangingHandle] = useState(false)
    const [changeBusy, setChangeBusy] = useState(false)
    const [changeError, setChangeError] = useState<string>()
    const [changeDone, setChangeDone] = useState(false)

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

    // 公式Blueskyアプリ等からのログイン用アプリパスワード。管理UIはドロワー(BskyAppPasswords)
    const [appPasswordsOpen, setAppPasswordsOpen] = useState(false)
    const appPasswordSupported = 'world.concrnt.atproto.appPasswords' in (client.server?.endpoints ?? {})
    const changeHandleSupported = 'world.concrnt.atproto.changeHandle' in (client.server?.endpoints ?? {})

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
                {info && (!info.entity || (info.entity.status === 'pending' && editingHandle)) && (
                    <>
                        {!info.entity && (
                            <>
                                <Text>{t('enableIntro')}</Text>
                                <Text>{t('enableDescription')}</Text>
                                <Hint title={t('hintLabel')}>{t('newAccountHint')}</Hint>
                            </>
                        )}
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
                                        setEditingHandle(false)
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
                        {info.entity && (
                            <Button
                                variant="outlined"
                                onClick={() => {
                                    setSetupError(undefined)
                                    setEditingHandle(false)
                                }}
                            >
                                {t('cancelEdit')}
                            </Button>
                        )}
                    </>
                )}
                {info?.entity && info.entity.status === 'pending' && !editingHandle && (
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
                        <Button
                            variant="outlined"
                            onClick={() => {
                                setHandleDraft(info.entity!.handle)
                                setSetupError(undefined)
                                setEditingHandle(true)
                            }}
                        >
                            {t('changeHandle')}
                        </Button>
                    </>
                )}
                {info?.entity && active && (
                    <>
                        <Text>{t('active')}</Text>
                        <Text>{t('yourHandle', { handle: info.entity.handle })}</Text>
                        <Text variant="caption">{info.entity.did}</Text>
                        {changeDone && <Text variant="caption">{t('changeHandleDone')}</Text>}
                        {changeHandleSupported && !changingHandle && (
                            <Button
                                variant="outlined"
                                onClick={() => {
                                    setHandleDraft('')
                                    setChangeError(undefined)
                                    setChangeDone(false)
                                    setChangingHandle(true)
                                }}
                            >
                                {t('changeHandle')}
                            </Button>
                        )}
                        {changingHandle && (
                            <>
                                <Text variant="h6" style={{ fontWeight: 'bold' }}>
                                    {t('changeHandleTitle')}
                                </Text>
                                <Text>{t('changeHandleDescription')}</Text>
                                <Text>{t('handleLabel')}</Text>
                                <TextField
                                    value={handleDraft}
                                    placeholder="alice.example.com"
                                    onChange={(e) => setHandleDraft(e.target.value)}
                                />
                                {handleOk && handle !== info.entity.handle && (
                                    <>
                                        <Text>{t('verifyDnsInstruction')}</Text>
                                        <RecordRow name={`_atproto.${handle}`} value={`did=${info.entity.did}`} />
                                        <Text>{t('verifyWellKnownInstruction')}</Text>
                                        <RecordRow
                                            name={`https://${handle}/.well-known/atproto-did`}
                                            value={info.entity.did}
                                        />
                                        <Text>{t('changeHandleNote')}</Text>
                                    </>
                                )}
                                {changeError && <Text style={{ color: '#ff5b5b' }}>{changeError}</Text>}
                                <Button
                                    disabled={!handleOk || handle === info.entity.handle || changeBusy}
                                    onClick={() => {
                                        setChangeBusy(true)
                                        setChangeError(undefined)
                                        client.api
                                            .callConcrntApi<BskyEntity>(
                                                client.server.domain,
                                                'world.concrnt.atproto.changeHandle',
                                                {},
                                                {
                                                    method: 'POST',
                                                    headers: { 'Content-Type': 'application/json' },
                                                    body: JSON.stringify({ handle })
                                                }
                                            )
                                            .then(() => {
                                                setChangingHandle(false)
                                                setChangeDone(true)
                                                updateInfo()
                                            })
                                            .catch((err) => {
                                                console.log(err)
                                                const msg = err instanceof Error ? err.message : ''
                                                setChangeError(
                                                    msg.includes('handle already taken')
                                                        ? t('changeHandleTaken')
                                                        : msg.includes('handle_not_resolvable') ||
                                                            msg.includes('did_mismatch')
                                                          ? t('changeHandleUnverified')
                                                          : t('changeHandleFailed')
                                                )
                                            })
                                            .finally(() => {
                                                setChangeBusy(false)
                                            })
                                    }}
                                >
                                    {t('changeHandleSubmit')}
                                </Button>
                                <Button
                                    variant="outlined"
                                    onClick={() => {
                                        setChangeError(undefined)
                                        setChangingHandle(false)
                                    }}
                                >
                                    {t('cancelEdit')}
                                </Button>
                            </>
                        )}
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
                                <Hint title={t('hintLabel')}>{t('appPasswordHint')}</Hint>
                                <Button variant="outlined" onClick={() => setAppPasswordsOpen(true)}>
                                    {t('manageAppPasswords')}
                                </Button>
                                <Drawer open={appPasswordsOpen} onClose={() => setAppPasswordsOpen(false)}>
                                    <BskyAppPasswords login={info.login} />
                                </Drawer>
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
