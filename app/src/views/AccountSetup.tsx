import { invoke } from '@tauri-apps/api/core'
import { Button, View, Text, TextField } from '@concrnt/ui'
import { useEffect, useState } from 'react'
import { useResetPreference } from '../contexts/Preference'
import { TauriAuthProvider } from '../lib/authProvider'
import { Api, InMemoryKVS, Document } from '@concrnt/client'
import { useClient } from '../contexts/Client'
import { openUrl } from '@tauri-apps/plugin-opener'

interface Props {
    onBack?: () => void
}

export const AccountSetup = (props: Props) => {
    const { reload } = useClient()
    const reset = useResetPreference()

    const [domain, setDomain] = useState<string>('v2dev.concrnt.net')
    const [existingCCID, setExistingCCID] = useState<string | null>(null)

    useEffect(() => {
        invoke('has_masterkey').then((existing) => {
            if (typeof existing !== 'string') return
            setExistingCCID(existing)
        })
    }, [])

    return (
        <View
            style={{
                gap: 16
            }}
        >
            <Button onClick={props.onBack}>Back</Button>

            {existingCCID ? (
                <>
                    <Text>端末にはすでにアカウントが保存されています</Text>
                    <Text>CCID: {existingCCID}</Text>

                    <Text>端末に保存されたアカウントを使用する</Text>

                    <Text>Domain</Text>
                    <TextField value={domain} onChange={(e) => setDomain(e.target.value)} />

                    <Button
                        onClick={async () => {
                            const ccid = existingCCID

                            const ckid: string = await invoke('create_subkey')

                            const subkeyDoc: Document<any> = {
                                key: `cckv://${ccid}/keys/${ckid}`,
                                author: ccid,
                                schema: 'https://schema.concrnt.net/subkey.json',
                                value: {
                                    ckid
                                },
                                createdAt: new Date()
                            }

                            const authProvider = new TauriAuthProvider(ccid)
                            const kvs = new InMemoryKVS()

                            const api = new Api(domain, authProvider, kvs)

                            await api.commit(subkeyDoc, domain, { useMasterkey: true })
                            console.log('Subkey Registered')

                            await invoke('set_domain', { domain })

                            reset()
                            reload()
                        }}
                    >
                        ログイン
                    </Button>

                    <Button
                        style={{
                            backgroundColor: 'transparent',
                            color: 'red',
                            border: '1px solid red'
                        }}
                        onClick={async () => {
                            await invoke('clear_all').then(async () => {
                                reset()
                                await reload()
                                window.location.reload()
                            })
                        }}
                    >
                        リセットする
                    </Button>
                </>
            ) : (
                <>
                    <Text>Domain</Text>
                    <TextField value={domain} onChange={(e) => setDomain(e.target.value)} />

                    <Button
                        onClick={async () => {
                            const ccid: string = await invoke('initialize_master')
                            const authProvider = new TauriAuthProvider(ccid)
                            const kvs = new InMemoryKVS()

                            const api = new Api(domain, authProvider, kvs)

                            const document = {
                                author: ccid,
                                schema: 'https://schema.concrnt.net/affiliation.json',
                                value: {
                                    domain
                                },
                                createdAt: new Date().toISOString()
                            }

                            const docString = JSON.stringify(document)
                            const signature = await authProvider.signMaster(docString)

                            const request = {
                                affiliationDocument: docString,
                                affiliationSignature: signature,
                                meta: {}
                            }

                            await api.requestConcrntApi(
                                domain,
                                'net.concrnt.world.register',
                                {},
                                {
                                    method: 'POST',
                                    body: JSON.stringify(request),
                                    headers: {
                                        'Content-Type': 'application/json'
                                    }
                                }
                            )
                            console.log('Registered')

                            const ckid: string = await invoke('create_subkey')

                            const subkeyDoc: Document<any> = {
                                key: `cckv://${ccid}/keys/${ckid}`,
                                author: ccid,
                                schema: 'https://schema.concrnt.net/subkey.json',
                                value: {
                                    ckid
                                },
                                createdAt: new Date()
                            }

                            await api.commit(subkeyDoc, domain, { useMasterkey: true })
                            console.log('Subkey Registered')

                            await invoke('set_domain', { domain })

                            reset()
                            reload()
                        }}
                    >
                        {' '}
                        登録
                    </Button>

                    <Button
                        onClick={async () => {
                            const ccid: string = await invoke('initialize_master')

                            const authProvider = new TauriAuthProvider(ccid)

                            const document = {
                                author: ccid,
                                schema: 'https://schema.concrnt.net/affiliation.json',
                                value: {
                                    domain
                                },
                                createdAt: new Date().toISOString()
                            }

                            const docString = JSON.stringify(document)
                            const signature = await authProvider.signMaster(docString)

                            const encodedDoc = btoa(docString).replace('+', '-').replace('/', '_').replace('==', '')

                            openUrl(
                                `https://${domain}/register?document=${encodedDoc}&signature=${signature}`,
                                'inAppBrowser'
                            )
                        }}
                    >
                        登録ページを開く
                    </Button>
                </>
            )}
        </View>
    )
}
