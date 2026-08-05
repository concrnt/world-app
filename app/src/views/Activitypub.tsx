import { View, Text, TextField, Button, Divider, IconButton } from '@concrnt/ui'
import { Header } from '../ui/Header'
import { CssVar } from '../types/Theme'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useClient } from '../contexts/Client'
import { useStack } from '../layouts/Stack'
import { ApView } from './ApView'
import { NotFoundError } from '@concrnt/client'
import { Schemas, semantics, type Timeline } from '@concrnt/worldlib'
import { MdPlaylistAdd } from 'react-icons/md'
import { Subscription } from '../components/Subscription'
import { ApFollowList } from '../components/ApFollowList'
import { Drawer } from '../ui/Drawer'
import { TimelinePicker } from '../components/TimelinePicker'
import { useSubscribe } from '../hooks/useSubscribe'
import { apSettingsKey } from '../utils/activitypub'

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
                const inboxUri = `cckv://${client.ccid}/activitypub.concrnt.world/inbox`
                const inboxValue = {
                    name: 'ActivityPub',
                    shortname: 'activitypub',
                    description: 'ActivityPub home stream'
                }
                const defaultPolicy = {
                    entries: [
                        {
                            url: 'https://policy.concrnt.world/t/allow-writers.json',
                            params: {
                                entities: [res.serviceAccountId]
                            }
                        }
                    ]
                }

                client.api
                    .getDocument<any>(inboxUri)
                    .then((doc) => {
                        // 旧クライアントが作ったinboxはuserTimelineスキーマで名前を持てないため、
                        // communityTimelineスキーマに上書き修復する(ポリシーは維持)
                        if (doc.schema === Schemas.communityTimeline && doc.value?.name) return
                        console.log('Inbox has no metadata. repairing...')
                        client.api.commit({
                            kind: 'record' as const,
                            key: inboxUri,
                            author: client.ccid,
                            schema: Schemas.communityTimeline,
                            value: inboxValue,
                            createdAt: new Date(),
                            policy: doc.policy ?? defaultPolicy
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
                createdAt: new Date()
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
                            <Subscription target={`cckv://${client.ccid}/activitypub.concrnt.world/inbox`} />
                        </Drawer>
                        <Divider />
                        <Text>{t('forwardTimeline')}</Text>
                        <Text>{t('forwardTimelineDesc')}</Text>
                        <TimelinePicker
                            items={knownCommunities.filter(
                                (tl: Timeline) => !tl.uri.includes('/activitypub.concrnt.world/')
                            )}
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
