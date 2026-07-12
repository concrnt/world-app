import { Text, TextField, Button, Divider, IconButton } from '@concrnt/ui'
import { CssVar } from '../types/Theme'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useClient } from '../contexts/Client'
import { NotFoundError } from '@concrnt/client'
import { useNavigate } from 'react-router-dom'
import { Schemas } from '@concrnt/worldlib'
import { MdPlaylistAdd } from 'react-icons/md'
import { Subscription } from '../components/Subscription'
import { useDrawer } from '../contexts/Drawer'
import { View } from '../components/View'
import { Header } from '../components/Header'

interface ApSettings {
    id: string
    ccid: string
    enabled: boolean
    listenTimelines: string[]
}

interface ApServerInfo {
    serviceAccountId: string
}

export const Activitypub = () => {
    const { t } = useTranslation('', { keyPrefix: 'views.activitypub' })
    const { client } = useClient()
    const drawer = useDrawer()
    const navigate = useNavigate()

    const [settings, setSettings] = useState<ApSettings | undefined | null>(undefined)
    const [idDraft, setIDDraft] = useState('')
    const idOk = idDraft.length > 0 && idDraft.match(/^[a-zA-Z0-9_]+$/)

    const [lookupDraft, setLookupDraft] = useState('')

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
            .callConcrntApi<any>(client.server.domain, 'net.concrnt.activitypub.stats', {})
            .then((res) => {
                console.log('AP stats', res)
            })
            .catch((err) => {
                console.log(err)
            })

        client.api
            .callConcrntApi<ApServerInfo>(client.server.domain, 'net.concrnt.activitypub.info', {})
            .then((res) => {
                const inboxUri = `cckv://${client.ccid}/activitypub.concrnt.world/inbox`

                client.api
                    .getDocument(inboxUri)
                    .then((_doc) => {})
                    .catch((err) => {
                        if (err instanceof NotFoundError) {
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
                                                entities: [res.serviceAccountId]
                                            }
                                        }
                                    ]
                                }
                            }

                            client.api.commit(document)
                        }
                    })
            })
            .catch((err) => {
                console.log(err)
            })

        // const inboxUri = `cckv://${client.ccid}/activitypub.concrnt.world/inbox`
    }, [])

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
                                drawer.open(
                                    <Subscription target={`cckv://${client.ccid}/activitypub.concrnt.world/inbox`} />
                                )
                            }}
                        >
                            <MdPlaylistAdd size={24} />
                        </IconButton>
                        <TextField value={lookupDraft} onChange={(e) => setLookupDraft(e.target.value)} />
                        <Button
                            onClick={() => {
                                navigate('/activitypub/view/' + encodeURIComponent(lookupDraft))
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
