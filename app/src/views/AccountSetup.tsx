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

    const [ccid, setCCID] = useState<string | undefined>(undefined)
    const [domain, setDomain] = useState<string>('v2dev.concrnt.net')

    useEffect(() => {
        invoke('initialize_master').then((ccid) => {
            console.log('ccid', ccid)
            setCCID(ccid as string)
        })
    }, [])

    return (
        <View>
            <Button onClick={props.onBack}>Back</Button>

            <Button
                onClick={async () => {
                    if (!ccid) return
                    const authProvider = new TauriAuthProvider(ccid)
                    authProvider.signMaster('hogehogehoge').then((signature) => {
                        console.log('signature', signature)
                    })
                }}
            >
                Test
            </Button>

            {ccid ? (
                <>
                    <Text>CCID: {ccid}</Text>

                    <Text>Domain</Text>
                    <TextField value={domain} onChange={(e) => setDomain(e.target.value)} />

                    <Button
                        onClick={async () => {
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
                        登録ページを開く(準備中)
                    </Button>
                </>
            ) : (
                <Text>じゅんびちゅう</Text>
            )}
        </View>
    )
}
