import { View, Text, TextField, Button, Divider } from '@concrnt/ui'
import { Header } from '../ui/Header'
import { useEffect, useState } from 'react'
import { useClient } from '../contexts/Client'
import { useStack } from '../layouts/Stack'
import { ApView } from './ApView'
import { NotFoundError } from '@concrnt/client'
import { Schemas } from '@concrnt/worldlib'

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
    const { client } = useClient()

    const [settings, setSettings] = useState<ApSettings | undefined | null>(undefined)
    const [idDraft, setIDDraft] = useState('')
    const idOk = idDraft.length > 0 && idDraft.match(/^[a-zA-Z0-9_]+$/)

    const [lookupDraft, setLookupDraft] = useState('')

    const stack = useStack()

    useEffect(() => {
        client.api
            .fetchWithCredential<ApSettings>(client.server.domain, '/ap/api/settings')
            .then((res) => {
                setSettings(res)
            })
            .catch((err) => {
                console.log(err)
                setSettings(null)
            })

        client.api
            .fetchWithCredential<any>(client.server.domain, '/ap/api/stats')
            .then((res) => {
                console.log('AP stats', res)
            })
            .catch((err) => {
                console.log(err)
            })

        client.api
            .fetchWithCredential<ApServerInfo>(client.server.domain, '/ap/api/info')
            .then((res) => {
                const inboxUri = `cckv://${client.ccid}/activitypub.concrnt.world/inbox`

                client.api
                    .getDocument(inboxUri)
                    .then((_doc) => {})
                    .catch((err) => {
                        if (err instanceof NotFoundError) {
                            console.log('Inbox not found. creating...')
                            const document = {
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
            <Header>Activitypub設定</Header>
            {settings === undefined && <p>読み込み中...</p>}
            {settings === null && (
                <div>
                    <Text>Activitypub連携を有効化しましょう</Text>
                    <Text>連携を有効化すると、Activitypub対応のSNSと繋がることができます。</Text>

                    <Text>希望のID</Text>
                    <TextField value={idDraft} onChange={(e) => setIDDraft(e.target.value)} />

                    <Button
                        disabled={!idOk}
                        onClick={() => {
                            client.api
                                .fetchWithCredential<ApSettings>(client.server.domain, '/ap/api/setup', {
                                    method: 'POST',
                                    body: JSON.stringify({
                                        id: idDraft
                                    })
                                })
                                .then((res) => {
                                    setSettings(res)
                                })
                                .catch((err) => {
                                    console.log(err)
                                })
                        }}
                    >
                        有効化
                    </Button>
                </div>
            )}
            {settings && (
                <div>
                    <Text>Activitypub連携は有効化されています。</Text>
                    <Text>あなたのID: {settings.id}</Text>

                    <Divider />

                    <TextField value={lookupDraft} onChange={(e) => setLookupDraft(e.target.value)} />
                    <Button
                        onClick={() => {
                            stack.push(<ApView uri={lookupDraft} />)
                        }}
                    >
                        照会
                    </Button>
                </div>
            )}
        </View>
    )
}
