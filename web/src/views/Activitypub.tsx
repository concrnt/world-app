import { Text, TextField, Button, Divider, IconButton, Confirm } from '@concrnt/ui'
import { CssVar } from '../types/Theme'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useClient } from '../contexts/Client'
import { NotFoundError, type Document, type PolicyEntry } from '@concrnt/client'
import { useNavigate } from 'react-router-dom'
import { Schemas, semantics } from '@concrnt/worldlib'
import { MdDelete, MdPlaylistAdd } from 'react-icons/md'
import { Subscription } from '../components/Subscription'
import { ApFollowList } from '../components/ApFollowList'
import { Drawer } from '../components/Drawer'
import { View } from '../components/View'
import { Header } from '../components/Header'
import { TimelinePicker } from '../components/TimelinePicker'
import { CompositeSearchProvider, KnownCommunitySearchProvider, StaticSearchProvider } from '../lib/timelineSearch'
import { useSubscribe } from '../hooks/useSubscribe'
import { apFollowsKey, apInboxKey, apSettingsKey, resolveApObject } from '../utils/activitypub'

interface ApSettings {
    id: string
    ccid: string
    enabled: boolean
    movedTo: string | null
}

interface ApSettingsValue {
    listenTimelines: string[]
    aliases?: string[]
}

interface ApServerInfo {
    serviceAccountId: string
}

export const Activitypub = () => {
    const { t } = useTranslation('', { keyPrefix: 'views.activitypub' })
    const { client } = useClient()
    const [subscriptionOpen, setSubscriptionOpen] = useState(false)
    const navigate = useNavigate()

    const [settings, setSettings] = useState<ApSettings | undefined | null>(undefined)
    const [idDraft, setIDDraft] = useState('')
    const idOk = idDraft.length > 0 && idDraft.match(/^[a-zA-Z0-9_]+$/)

    const [lookupDraft, setLookupDraft] = useState('')

    // ブリッジ設定レコードの保存済みの値。転送元タイムラインと引っ越し元(aliases)を同じレコードに持つので、
    // 片方を保存するときはもう片方を保存済みの値のまま書く
    const [apSettings, setApSettings] = useState<ApSettingsValue>({ listenTimelines: [] })
    const aliases = apSettings.aliases ?? []
    const [aliasDraft, setAliasDraft] = useState('')
    const [aliasError, setAliasError] = useState(false)
    const [moveDraft, setMoveDraft] = useState('')
    const [moveConfirmOpen, setMoveConfirmOpen] = useState(false)
    const [moveError, setMoveError] = useState(false)
    const moveSupported = 'net.concrnt.activitypub.move' in (client.server?.endpoints ?? {})

    // 転送元タイムライン設定。ブリッジが直接読むcckvレコードが正本。
    // ホーム(プロフィール選択可)+コミュニティの複数選択で、未設定(空)はホームにフォールバックする。
    const [listenHome, setListenHome] = useState(true)
    const [listenProfile, setListenProfile] = useState('main')
    const [listenCommunities, setListenCommunities] = useState<string[]>([])

    const homeTimelineRegex = new RegExp(`^cckv://${client.ccid}/concrnt\\.world/profiles/([^/]+)/home-timeline$`)
    const inboxUri = apInboxKey(client.ccid)
    // 転送先の候補: リスト未登録だとknownCommunitiesに現れない自分のinboxを常に先頭に出し、
    // 続けてブリッジ由来以外の登録済みコミュニティを並べる(crawlerのグローバル検索は使わない)
    const forwardProvider = useMemo(
        () =>
            new CompositeSearchProvider([
                new StaticSearchProvider([{ uri: inboxUri, name: 'ActivityPub', known: false }]),
                new KnownCommunitySearchProvider(client, (tl) => !tl.uri.includes('/activitypub.concrnt.world/'))
            ]),
        [client, inboxUri]
    )
    const allowWriters = 'https://policy.concrnt.world/t/allow-writers.json'
    const allowEditors = 'https://policy.concrnt.world/t/allow-editors.json'

    // ActivityPubタイムラインはリスト未登録だとknownCommunitiesに出ない上、
    // どのリストにも無いと受信した投稿を見る手段が無いので警告を出す
    const [pinnedLists] = useSubscribe(client.pinnedLists)
    const [inboxListed, setInboxListed] = useState(true)

    // inboxのpolicyがブリッジの現serviceAccountIdを許可していないと配送が全て拒否される
    // (誤ったIDが広告された期間に設定画面を開くと壊れたpolicyが書き込まれる事故があった)
    const [inboxPolicyBroken, setInboxPolicyBroken] = useState(false)
    const [repairError, setRepairError] = useState(false)
    useEffect(() => {
        Promise.all(
            pinnedLists.map(async (pin) => {
                const list = await pin.list.value()
                return list ? await list.items.value() : []
            })
        )
            .then((arr) => setInboxListed(arr.some((items) => items.includes(inboxUri))))
            .catch(() => {})
    }, [pinnedLists, subscriptionOpen])

    useEffect(() => {
        client.api
            .callConcrntApi<ApSettings>(client.server.domain, 'net.concrnt.activitypub.settings', {})
            .then((res) => {
                setSettings(res)
            })
            .catch((err) => {
                console.log(err)
                setSettings(null)
            })

        client.api
            .getDocument<ApSettingsValue>(apSettingsKey(client.ccid))
            .then((doc) => {
                setApSettings(doc.value)
                const timelines = doc.value?.listenTimelines ?? []
                const homeProfile = timelines.map((uri) => uri.match(homeTimelineRegex)?.[1]).find((m) => m)
                setListenHome(timelines.length === 0 || homeProfile !== undefined)
                if (homeProfile) setListenProfile(homeProfile)
                setListenCommunities(timelines.filter((uri) => !homeTimelineRegex.test(uri)))
            })
            .catch((err) => {
                if (!(err instanceof NotFoundError)) console.log(err)
            })

        client.api
            .callConcrntApi<ApServerInfo>(client.server.domain, 'net.concrnt.activitypub.info', {})
            .then((res) => {
                // フォロー先の引っ越し(Move)を受けたとき、ブリッジがフォローレコードを代理で付け替えられるよう
                // follows直下の作成・更新・削除権をサービスアカウントに渡す
                client.api.getDocument(apFollowsKey(client.ccid)).catch((err) => {
                    if (!(err instanceof NotFoundError)) return
                    client.api.commit({
                        kind: 'record' as const,
                        key: apFollowsKey(client.ccid),
                        author: client.ccid,
                        schema: Schemas.empty,
                        value: {},
                        createdAt: new Date(),
                        policy: { entries: [{ url: allowEditors, params: { entities: [res.serviceAccountId] } }] }
                    })
                })

                const inboxValue = {
                    name: 'ActivityPub',
                    shortname: 'activitypub',
                    description: 'ActivityPub home stream'
                }
                const defaultPolicy = {
                    entries: [
                        {
                            url: allowWriters,
                            params: {
                                entities: [res.serviceAccountId]
                            }
                        }
                    ]
                }

                client.api
                    .getDocument<any>(inboxUri)
                    .then((doc) => {
                        // 配送時のrequesterはブリッジのserviceAccountIdなので、allow-writersの
                        // entitiesに現在のIDが含まれていないと受信が全て拒否される
                        const broken = !(
                            doc.policy?.entries?.some(
                                (e: PolicyEntry) =>
                                    e.url === allowWriters &&
                                    Array.isArray(e.params?.entities) &&
                                    e.params.entities.includes(res.serviceAccountId)
                            ) ?? false
                        )
                        // 旧クライアントが作ったinboxはuserTimelineスキーマで名前を持てず、その後の
                        // communityTimelineスキーマはexplorer検索(community全件index)に個人inboxが並ぶため、
                        // apInboxTimelineスキーマに上書き修復する(名前があればvalue、ポリシーは維持)
                        if (doc.schema === Schemas.apInboxTimeline && doc.value?.name) {
                            setInboxPolicyBroken(broken)
                            return
                        }
                        console.log('Inbox schema is outdated or has no metadata. repairing...')
                        client.api
                            .commit({
                                kind: 'record' as const,
                                key: inboxUri,
                                author: client.ccid,
                                schema: Schemas.apInboxTimeline,
                                value:
                                    doc.schema === Schemas.communityTimeline && doc.value?.name
                                        ? doc.value
                                        : inboxValue,
                                createdAt: new Date(),
                                policy: doc.policy ?? defaultPolicy
                            })
                            // 警告(=修復ボタン)はこのcommitの完了後に出す。in-flightの自動commitが
                            // 修復ボタンのcommit後に着弾して誤policyを書き戻す競合を避けるため
                            .then(() => setInboxPolicyBroken(doc.policy ? broken : false))
                            .catch((err) => {
                                console.log(err)
                                setInboxPolicyBroken(broken)
                            })
                    })
                    .catch((err) => {
                        if (err instanceof NotFoundError) {
                            console.log('Inbox not found. creating...')
                            client.api.commit({
                                kind: 'record' as const,
                                key: inboxUri,
                                author: client.ccid,
                                schema: Schemas.apInboxTimeline,
                                value: inboxValue,
                                createdAt: new Date(),
                                policy: defaultPolicy
                            })
                        }
                    })
            })
            .catch((err) => {
                console.log(err)
            })
    }, [])

    const repairInboxPolicy = async (): Promise<void> => {
        setRepairError(false)
        try {
            // マウント時のIDは誤ったIDが広告されていた期間のものかもしれないので、押下時点で取り直す
            const info = await client.api.callConcrntApi<ApServerInfo>(
                client.server.domain,
                'net.concrnt.activitypub.info',
                {}
            )
            // staleキャッシュ由来の誤検知のまま上書きしないよう、書き込み前にno-cacheで確定させる
            let doc: Document<any> | null = null
            try {
                doc = await client.api.getDocument<any>(inboxUri, undefined, { cache: 'no-cache' })
            } catch (err) {
                if (!(err instanceof NotFoundError)) throw err
            }
            const alreadyOk =
                doc?.policy?.entries?.some(
                    (e: PolicyEntry) =>
                        e.url === allowWriters &&
                        Array.isArray(e.params?.entities) &&
                        e.params.entities.includes(info.serviceAccountId)
                ) ?? false
            if (alreadyOk) {
                setInboxPolicyBroken(false)
                return
            }
            // allow-writers系entryは全て除去して正規形1本に置換(誤IDに書き込み権を残さない)。
            // restrict-readers等の他entryは温存
            const entries = (doc?.policy?.entries ?? []).filter((e: PolicyEntry) => e.url !== allowWriters)
            entries.push({ url: allowWriters, params: { entities: [info.serviceAccountId] } })
            const value =
                (doc?.schema === Schemas.apInboxTimeline || doc?.schema === Schemas.communityTimeline) &&
                doc.value?.name
                    ? doc.value
                    : { name: 'ActivityPub', shortname: 'activitypub', description: 'ActivityPub home stream' }
            await client.api.commit({
                kind: 'record' as const,
                key: inboxUri,
                author: client.ccid,
                schema: Schemas.apInboxTimeline,
                value,
                createdAt: new Date(),
                policy: { entries }
            })
            setInboxPolicyBroken(false)
        } catch (err) {
            console.error('failed to repair inbox policy:', err)
            setRepairError(true)
        }
    }

    const saveApSettings = async (value: ApSettingsValue): Promise<void> => {
        await client.api.commit({
            kind: 'record' as const,
            key: apSettingsKey(client.ccid),
            author: client.ccid,
            schema: Schemas.apSettings,
            value,
            createdAt: new Date()
        })
        setApSettings(value)
    }

    const updateListenTimelines = () => {
        const listenTimelines = [
            ...(listenHome ? [semantics.homeTimeline(client.ccid, listenProfile)] : []),
            ...listenCommunities
        ]
        saveApSettings({ ...apSettings, listenTimelines }).catch((err) => {
            console.log(err)
        })
    }

    const addAlias = async (): Promise<void> => {
        setAliasError(false)
        // Person.alsoKnownAsには正規のアクターidを載せる(ハンドルやプロフィールURLのままだと移行元が照合できない)
        const actor = await resolveApObject(client, aliasDraft.trim()).catch(() => null)
        if (!actor?.id) {
            setAliasError(true)
            return
        }
        await saveApSettings({ ...apSettings, aliases: [...new Set([...aliases, actor.id])] })
        setAliasDraft('')
    }

    const move = async (): Promise<void> => {
        setMoveError(false)
        try {
            const res = await client.api.callConcrntApi<{ movedTo: string }>(
                client.server.domain,
                'net.concrnt.activitypub.move',
                {},
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ target: moveDraft.trim() })
                }
            )
            setSettings((prev) => prev && { ...prev, movedTo: res.movedTo })
        } catch (err) {
            console.log(err)
            setMoveError(true)
        }
    }

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
                {settings === undefined && <Text>{t('loading')}</Text>}
                {settings === null && (
                    <>
                        <Text>{t('enableIntro')}</Text>
                        <Text>{t('enableDescription')}</Text>
                        <Text>{t('desiredId')}</Text>
                        <TextField value={idDraft} onChange={(e) => setIDDraft(e.target.value)} />
                        <Button
                            disabled={!idOk}
                            onClick={() => {
                                client.api
                                    .callConcrntApi<ApSettings>(
                                        client.server.domain,
                                        'net.concrnt.activitypub.setup',
                                        {},
                                        {
                                            method: 'POST',
                                            headers: { 'Content-Type': 'application/json' },
                                            body: JSON.stringify({
                                                id: idDraft
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
                        >
                            {t('enable')}
                        </Button>
                    </>
                )}
                {settings && (
                    <>
                        <Text>{t('enabled')}</Text>
                        <Text>{t('yourId', { id: settings.id })}</Text>
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
                            <Subscription target={inboxUri} />
                        </Drawer>
                        {!inboxListed && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: CssVar.space(1) }}>
                                <Text variant="caption" style={{ color: 'red' }}>
                                    {t('inboxNotListed')}
                                </Text>
                                <Button variant="text" onClick={() => setSubscriptionOpen(true)}>
                                    {t('addToList')}
                                </Button>
                            </div>
                        )}
                        {inboxPolicyBroken && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: CssVar.space(1) }}>
                                <Text variant="caption" style={{ color: 'red' }}>
                                    {t('inboxPolicyBroken')}
                                </Text>
                                <Button variant="text" busyChildren={t('repairing')} onClick={repairInboxPolicy}>
                                    {t('repair')}
                                </Button>
                            </div>
                        )}
                        {repairError && (
                            <Text variant="caption" style={{ color: 'red' }}>
                                {t('repairFailed')}
                            </Text>
                        )}
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
                        <Button onClick={updateListenTimelines}>{t('update')}</Button>
                        <Divider />
                        <TextField value={lookupDraft} onChange={(e) => setLookupDraft(e.target.value)} />
                        <Button
                            onClick={() => {
                                navigate('/activitypub/view/' + encodeURIComponent(lookupDraft))
                            }}
                        >
                            {t('inquiry')}
                        </Button>
                        <Divider />
                        <ApFollowList />
                        {moveSupported && (
                            <>
                                <Divider />
                                <Text>{t('moveOrigins')}</Text>
                                <Text variant="caption">{t('moveOriginsDesc')}</Text>
                                {aliases.map((alias) => (
                                    <div
                                        key={alias}
                                        style={{ display: 'flex', alignItems: 'center', gap: CssVar.space(1) }}
                                    >
                                        <Text style={{ flex: 1, wordBreak: 'break-all' }}>{alias}</Text>
                                        <IconButton
                                            onClick={() => {
                                                saveApSettings({
                                                    ...apSettings,
                                                    aliases: aliases.filter((a) => a !== alias)
                                                }).catch((err) => {
                                                    console.log(err)
                                                })
                                            }}
                                        >
                                            <MdDelete size={20} />
                                        </IconButton>
                                    </div>
                                ))}
                                <TextField
                                    value={aliasDraft}
                                    placeholder="@user@example.com"
                                    onChange={(e) => setAliasDraft(e.target.value)}
                                />
                                {aliasError && (
                                    <Text variant="caption" style={{ color: 'red' }}>
                                        {t('aliasNotFound')}
                                    </Text>
                                )}
                                <Button disabled={aliasDraft.trim() === ''} onClick={addAlias}>
                                    {t('addMoveOrigin')}
                                </Button>
                                <Divider />
                                <Text>{t('moveTo')}</Text>
                                {settings.movedTo ? (
                                    <Text>{t('movedTo', { target: settings.movedTo })}</Text>
                                ) : (
                                    <>
                                        <Text variant="caption">
                                            {t('moveToDesc', { handle: `@${settings.id}@${client.server.domain}` })}
                                        </Text>
                                        <TextField
                                            value={moveDraft}
                                            placeholder="@user@example.com"
                                            onChange={(e) => setMoveDraft(e.target.value)}
                                        />
                                        {moveError && (
                                            <Text variant="caption" style={{ color: 'red' }}>
                                                {t('moveFailed', { handle: `@${settings.id}@${client.server.domain}` })}
                                            </Text>
                                        )}
                                        <Button
                                            disabled={moveDraft.trim() === ''}
                                            onClick={() => setMoveConfirmOpen(true)}
                                        >
                                            {t('move')}
                                        </Button>
                                        <Confirm
                                            open={moveConfirmOpen}
                                            onClose={() => setMoveConfirmOpen(false)}
                                            title={t('moveConfirmTitle')}
                                            description={t('moveConfirmDescription', { target: moveDraft.trim() })}
                                            confirmText={t('move')}
                                            onConfirm={move}
                                        />
                                    </>
                                )}
                            </>
                        )}
                    </>
                )}
            </div>
        </View>
    )
}
