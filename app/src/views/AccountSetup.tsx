import { invoke } from '@tauri-apps/api/core'
import { Button, View, Text, CssVar } from '@concrnt/ui'
import { useEffect, useRef, useState } from 'react'
import { useResetPreference } from '../contexts/Preference'
import { TauriAuthProvider } from '../lib/authProvider'
import { Api, InMemoryKVS, Document, InMemoryAuthProvider } from '@concrnt/client'
import { useClient } from '../contexts/Client'
import { openUrl } from '@tauri-apps/plugin-opener'
import { semantics } from '@concrnt/worldlib'
import Tilt from 'react-parallax-tilt'
import { Passport } from '@concrnt/ui'

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

    const serverInput = useRef<HTMLInputElement>(null)

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

    const openRegistrationPage = async (domain: string) => {
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

        openUrl(`https://${domain}/register?document=${encodedDoc}&signature=${signature}`, 'inAppBrowser')

        setRegistrationPageOpened(true)
    }

    const state = accountCreated ? 'done' : 'initial'

    return (
        <View
            style={{
                gap: 16
            }}
        >
            {state === 'initial' && (
                <div
                    style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: CssVar.space(2)
                    }}
                >
                    <Text variant="h1">アカウントを作成しましょう</Text>

                    <div
                        style={{
                            width: '90vw',
                            margin: '20px 0'
                        }}
                    >
                        <Tilt glareEnable={true} glareBorderRadius="5%">
                            <Passport
                                ccid={'con1......................................'}
                                name={'...'}
                                avatar={''}
                                host={'TBD'}
                                cdate={new Date().toLocaleDateString()}
                            />
                        </Tilt>
                    </div>

                    <Text>{props.entrypoint === domain ? 'おすすめサーバー:' : 'カスタムサーバー:'}</Text>
                    <div
                        style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 0,
                            height: 32
                        }}
                    >
                        <input
                            ref={serverInput}
                            type="text"
                            value={domain}
                            onChange={(e) => setDomain(e.target.value)}
                            style={{
                                padding: '4px 8px',
                                borderRadius: `4px 0 0 4px`,
                                border: `1px solid ${CssVar.divider}`,
                                width: 200,
                                height: '100%'
                            }}
                        />
                        <div
                            style={{
                                display: 'inline-block',
                                padding: '4px 8px',
                                color: CssVar.uiText,
                                borderRadius: `0 4px 4px 0`,
                                backgroundColor: CssVar.uiBackground
                            }}
                            onClick={() => {
                                serverInput.current?.focus()
                            }}
                        >
                            変更
                        </div>
                    </div>

                    <Button
                        onClick={async () => {
                            openRegistrationPage(domain)
                        }}
                    >
                        {props.entrypoint === domain ? 'オススメではじめる' : 'このサーバーではじめる'}
                    </Button>

                    {registrationPageOpened && <Text>サーバー上でアカウントが作成されるのを待っています...</Text>}

                    <Button onClick={props.onBack}>Back</Button>
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
