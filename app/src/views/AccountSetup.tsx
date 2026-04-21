import { invoke } from '@tauri-apps/api/core'
import { Button, View, Text, TextField } from '@concrnt/ui'
import { useEffect, useState } from 'react'
import { useResetPreference } from '../contexts/Preference'
import { TauriAuthProvider } from '../lib/authProvider'
import { Api, InMemoryKVS, Document, InMemoryAuthProvider } from '@concrnt/client'
import { useClient } from '../contexts/Client'
import { openUrl } from '@tauri-apps/plugin-opener'
import { semantics } from '@concrnt/worldlib'

interface Props {
    entrypoint: string
    onBack?: () => void
}

export const AccountSetup = (props: Props) => {
    const { reload } = useClient()
    const reset = useResetPreference()

    const [domain, setDomain] = useState<string>(props.entrypoint)
    const [registrationPageOpened, setRegistrationPageOpened] = useState(false)
    const [accountCreated, setAccountCreated] = useState(false)
    const [profileCreated, setProfileCreated] = useState(false)

    useEffect(() => {
        const timer = setInterval(async () => {
            if (!registrationPageOpened) return
            if (accountCreated) {
                clearInterval(timer)
                return
            }

            const ccid = await invoke('has_masterkey')
            if (typeof ccid !== 'string') {
                console.log('CCID not found, waiting...')
                return
            }

            const auth = new InMemoryAuthProvider()
            const kvs = new InMemoryKVS()
            const api = new Api(domain, auth, kvs)

            const registration = await api.getEntity(ccid)
            if (!registration) {
                console.log('Registration not found, waiting...')
                return
            }

            console.log('Registration found:', registration)
            setAccountCreated(true)

            clearInterval(timer)
        }, 3000)

        return () => {
            clearInterval(timer)
        }
    }, [registrationPageOpened])

    const state = profileCreated ? 'done' : accountCreated ? 'account_created' : 'initial'

    return (
        <View
            style={{
                gap: 16
            }}
        >
            {state === 'initial' && (
                <div>
                    <Button onClick={props.onBack}>Back</Button>
                    <Text>Domain</Text>
                    <TextField value={domain} onChange={(e) => setDomain(e.target.value)} />

                    <Button
                        onClick={async () => {
                            const ccid: string = await invoke('initialize_master')

                            const authProvider = new TauriAuthProvider(ccid)

                            const document = {
                                author: ccid,
                                schema: 'https://schema.concrnt.net/entity.json',
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

                            setRegistrationPageOpened(true)
                        }}
                    >
                        登録ページを開く
                    </Button>

                    {registrationPageOpened && <Text>サーバー上でアカウントが作成されるのを待っています...</Text>}
                </div>
            )}
            {state === 'account_created' && (
                <div>
                    <Text>プロフィールを作成しましょう</Text>
                    <Button
                        onClick={() => {
                            setProfileCreated(true)
                        }}
                    >
                        あとで
                    </Button>
                </div>
            )}
            {state === 'done' && (
                <div>
                    <Text>準備完了</Text>
                    <Button
                        onClick={async () => {
                            const ccid = await invoke('has_masterkey')
                            if (typeof ccid !== 'string') {
                                alert('プログラムエラー: CCIDが見つかりません')
                                return
                            }

                            const authProvider = new TauriAuthProvider(ccid)
                            const kvs = new InMemoryKVS()

                            const api = new Api(domain, authProvider, kvs)

                            const ckid: string = await invoke('create_subkey')

                            const subkeyDoc: Document<any> = {
                                key: semantics.subkey(ccid, ckid),
                                author: ccid,
                                schema: 'https://schema.concrnt.net/subkey.json',
                                value: {
                                    ckid
                                },
                                createdAt: new Date()
                            }

                            await api.commit(subkeyDoc, domain, { useMasterkey: true })
                            await invoke('set_domain', { domain })

                            reset()
                            reload()
                        }}
                    >
                        完了
                    </Button>
                </div>
            )}
        </View>
    )
}
