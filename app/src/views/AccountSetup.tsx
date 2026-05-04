import { invoke } from '@tauri-apps/api/core'
import { Text, CssVar } from '@concrnt/ui'
import { useEffect, useRef, useState } from 'react'
import { useResetPreference } from '../contexts/Preference'
import { TauriAuthProvider } from '../lib/authProvider'
import { Api, InMemoryKVS, Document, InMemoryAuthProvider } from '@concrnt/client'
import { useReloadClient } from '../contexts/Client'
import { openUrl } from '@tauri-apps/plugin-opener'
import { semantics } from '@concrnt/worldlib'
import Tilt from 'react-parallax-tilt'
import { Passport } from '@concrnt/ui'
import { AuthActions, AuthButton, AuthHeader, AuthScreen, AuthTextButton, authStyles } from './authLayout'

interface Props {
    entrypoint: string
    onBack?: () => void
}

export const AccountSetup = (props: Props) => {
    const reload = useReloadClient()
    const reset = useResetPreference()

    const [domain, setDomain] = useState<string>(props.entrypoint)
    const [registrationPageOpened, setRegistrationPageOpened] = useState(false)
    const [accountCreated, setAccountCreated] = useState(false)
    const [finalizing, setFinalizing] = useState(false)

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
        <AuthScreen align="top">
            {state === 'initial' && (
                <>
                    <AuthHeader
                        title="アカウントを作成"
                        description="登録に使うサーバーを選んでから、ブラウザで登録を完了します。"
                    />

                    <div style={authStyles.passportWrap}>
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

                    <div style={authStyles.section}>
                        <div style={authStyles.inputGroup}>
                            <Text style={{ color: CssVar.uiText }}>
                                {props.entrypoint === domain ? 'おすすめサーバー' : 'カスタムサーバー'}
                            </Text>
                            <div
                                style={{
                                    display: 'flex',
                                    alignItems: 'stretch',
                                    width: '100%',
                                    height: 44
                                }}
                            >
                                <input
                                    ref={serverInput}
                                    type="text"
                                    value={domain}
                                    onChange={(e) => setDomain(e.target.value)}
                                    style={{
                                        flex: 1,
                                        minWidth: 0,
                                        padding: '8px 12px',
                                        borderRadius: `${CssVar.round(1)} 0 0 ${CssVar.round(1)}`,
                                        border: `1px solid ${CssVar.divider}`,
                                        backgroundColor: CssVar.contentBackground,
                                        color: CssVar.contentText,
                                        fontSize: 16
                                    }}
                                />
                                <button
                                    type="button"
                                    style={{
                                        padding: '0 14px',
                                        color: CssVar.uiBackground,
                                        border: `1px solid ${CssVar.uiText}`,
                                        borderLeft: 'none',
                                        borderRadius: `0 ${CssVar.round(1)} ${CssVar.round(1)} 0`,
                                        backgroundColor: CssVar.uiText,
                                        fontSize: 14,
                                        fontWeight: 700
                                    }}
                                    onClick={() => {
                                        serverInput.current?.focus()
                                    }}
                                >
                                    変更
                                </button>
                            </div>
                        </div>

                        <Text style={authStyles.status}>
                            {registrationPageOpened ? 'サーバー上でアカウントが作成されるのを待っています。' : ''}
                        </Text>
                    </div>

                    <AuthActions fixedBottom>
                        <AuthButton
                            onClick={async () => {
                                openRegistrationPage(domain)
                            }}
                        >
                            {props.entrypoint === domain ? 'おすすめサーバーではじめる' : 'このサーバーではじめる'}
                        </AuthButton>
                        <AuthTextButton onClick={props.onBack}>戻る</AuthTextButton>
                    </AuthActions>
                </>
            )}
            {state === 'done' && (
                <>
                    <AuthHeader
                        title="準備完了"
                        description="登録が確認できました。最後にこの端末で使う鍵を登録します。"
                    />
                    <AuthActions fixedBottom>
                        <AuthButton
                            disabled={finalizing}
                            onClick={async () => {
                                setFinalizing(true)
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

                                console.log('Committing subkey document:', subkeyDoc)
                                await api.commit(subkeyDoc, domain, { useMasterkey: true })
                                console.log('Subkey document committed')
                                await invoke('set_domain', { domain })
                                console.log('Domain set in backend')

                                reset()
                                console.log('Preferences reset')
                                await reload()
                                console.log('Client reloaded')
                            }}
                        >
                            {finalizing ? '登録中...' : '完了'}
                        </AuthButton>
                    </AuthActions>
                </>
            )}
        </AuthScreen>
    )
}
