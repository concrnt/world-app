import { View, Text, TextField, Button, Divider, IconButton } from '@concrnt/ui'
import { Header } from '../ui/Header'
import { CssVar } from '../types/Theme'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useClient } from '../contexts/Client'
import { useStack } from '../layouts/Stack'
import { ApView } from './ApView'
import { NotFoundError, type Document, type PolicyEntry } from '@concrnt/client'
import { Schemas, semantics, type Timeline } from '@concrnt/worldlib'
import { MdPlaylistAdd } from 'react-icons/md'
import { Subscription } from '../components/Subscription'
import { ApFollowList } from '../components/ApFollowList'
import { Drawer } from '../ui/Drawer'
import { TimelinePicker } from '../components/TimelinePicker'
import { useSubscribe } from '../hooks/useSubscribe'
import { apInboxKey, apSettingsKey } from '../utils/activitypub'

interface ApSettings {
    id: string
    ccid: string
    enabled: boolean
}

interface ApServerInfo {
    serviceAccountId: string
}

export const Activitypub = () => {
    const { t } = useTranslation('', { keyPrefix: 'views.activitypub' })
    const { client } = useClient()
    const [subscriptionOpen, setSubscriptionOpen] = useState(false)

    const [settings, setSettings] = useState<ApSettings | undefined | null>(undefined)
    const [idDraft, setIDDraft] = useState('')
    const idOk = idDraft.length > 0 && idDraft.match(/^[a-zA-Z0-9_]+$/)

    const [lookupDraft, setLookupDraft] = useState('')

    const stack = useStack()

    // 転送元タイムライン設定。ブリッジが直接読むcckvレコードが正本。
    // ホーム(プロフィール選択可)+コミュニティの複数選択で、未設定(空)はホームにフォールバックする。
    const [knownCommunities] = useSubscribe(client.knownCommunities)
    const [listenHome, setListenHome] = useState(true)
    const [listenProfile, setListenProfile] = useState('main')
    const [listenCommunities, setListenCommunities] = useState<string[]>([])

    const homeTimelineRegex = new RegExp(`^cckv://${client.ccid}/concrnt\\.world/profiles/([^/]+)/home-timeline$`)
    const inboxUri = apInboxKey(client.ccid)
    const allowWriters = 'https://policy.concrnt.world/t/allow-writers.json'

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
            .getDocument<{ listenTimelines: string[] }>(apSettingsKey(client.ccid))
            .then((doc) => {
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
                        // 旧クライアントが作ったinboxはuserTimelineスキーマで名前を持てないため、
                        // communityTimelineスキーマに上書き修復する(ポリシーは維持)
                        if (doc.schema === Schemas.communityTimeline && doc.value?.name) {
                            setInboxPolicyBroken(broken)
                            return
                        }
                        console.log('Inbox has no metadata. repairing...')
                        client.api
                            .commit({
                                kind: 'record' as const,
                                key: inboxUri,
                                author: client.ccid,
                                schema: Schemas.communityTimeline,
                                value: inboxValue,
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
                                schema: Schemas.communityTimeline,
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
                doc?.schema === Schemas.communityTimeline && doc.value?.name
                    ? doc.value
                    : { name: 'ActivityPub', shortname: 'activitypub', description: 'ActivityPub home stream' }
            await client.api.commit({
                kind: 'record' as const,
                key: inboxUri,
                author: client.ccid,
                schema: Schemas.communityTimeline,
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

    const updateListenTimelines = () => {
        const listenTimelines = [
            ...(listenHome ? [semantics.homeTimeline(client.ccid, listenProfile)] : []),
            ...listenCommunities
        ]
        client.api
            .commit({
                kind: 'record' as const,
                key: apSettingsKey(client.ccid),
                author: client.ccid,
                schema: Schemas.apSettings,
                value: { listenTimelines },
                createdAt: new Date(),
                onUpdate: 'forget'
            })
            .catch((err) => {
                console.log(err)
            })
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
                            items={[
                                // リスト未登録だとknownCommunitiesに現れないため、自分のinboxは常に候補に出す
                                { uri: inboxUri, name: 'ActivityPub' },
                                ...knownCommunities.filter(
                                    (tl: Timeline) => !tl.uri.includes('/activitypub.concrnt.world/')
                                )
                            ]}
                            selected={listenCommunities}
                            setSelected={setListenCommunities}
                            keyFunc={(item: Timeline) => item.uri}
                            labelFunc={(item: Timeline) => item.name ?? 'no name'}
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
                                stack.push(<ApView uri={lookupDraft} />)
                            }}
                        >
                            {t('inquiry')}
                        </Button>
                        <Divider />
                        <ApFollowList />
                    </>
                )}
            </div>
        </View>
    )
}
