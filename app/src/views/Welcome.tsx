import { invoke } from '@tauri-apps/api/core'
import { CssVar, Text, TextField } from '@concrnt/ui'
import Tilt from 'react-parallax-tilt'
import { useEffect, useState } from 'react'
import { AccountSetup } from '../views/AccountSetup'
import { AccountImport } from '../views/AccountImport'
import { Api, InMemoryKVS, Document, Entity, InMemoryAuthProvider } from '@concrnt/client'
import { Passport } from '@concrnt/ui'
import { ProfileSchema, semantics } from '@concrnt/worldlib'
import { TauriAuthProvider } from '../lib/authProvider'
import { useResetPreference } from '../contexts/Preference'
import { LoadingFull } from '../components/LoadingFull'
import { AuthActions, AuthBrand, AuthButton, AuthHeader, AuthScreen, AuthTextButton, authStyles } from './authLayout'

const entrypoint = 'cc2.tunnel.anthrotech.dev'
//const entrypoint = 'v2dev.concrnt.net'

/*
- 完全に初期状態 <initial>
    -> 新規作成
    -> インポート
- CCIDはあるが、サーバー登録がない/みつからない状態 <missing>
    -> 続きから
        -> 作成したことがある？
            -> 登録サーバーを探す
            -> 新しく登録
- CCIDもあり、登録サーバーもある状態 <ready>
    -> このアカウントで続行
    -> 別のアカウントにする (要注意)
*/

interface User {
    ccid: string
    entity?: Document<Entity>
    profile?: Document<ProfileSchema>
}

export const WelcomeView = () => {
    const [state, setState] = useState<'initial' | 'welcome' | 'signup' | 'signin' | 'missing' | 'ready'>('initial')
    const [existingCCID, setExistingCCID] = useState<string | null>(null)
    const [user, setUser] = useState<User | null>(null)
    const [updater, setUpdater] = useState<number>(0)
    const reset = useResetPreference()
    const [resolver, setResolver] = useState<string>(entrypoint)

    useEffect(() => {
        invoke('has_masterkey')
            .then(async (ccid) => {
                if (typeof ccid !== 'string') return
                setExistingCCID(ccid)

                const authProvider = new InMemoryAuthProvider()
                const kvs = new InMemoryKVS()

                const api = new Api(resolver, authProvider, kvs)

                const entity = await api.getEntity(ccid).catch(() => undefined)
                const profile = await api
                    .getDocument<ProfileSchema>(semantics.profile(ccid, 'main'))
                    .catch(() => undefined)

                setUser({
                    ccid,
                    entity,
                    profile
                })
                setState(entity ? 'ready' : 'missing')
            })
            .catch((_e) => {
                setExistingCCID(null)
                setUser(null)
                setState('welcome')
            })
    }, [updater, resolver])

    const reload = () => {
        setUpdater((prev) => prev + 1)
    }

    switch (state) {
        case 'initial':
            return <LoadingFull />
        case 'signup':
            return <AccountSetup entrypoint={entrypoint} onBack={() => setState('welcome')} />
        case 'signin':
            return <AccountImport onImported={reload} onBack={() => setState('welcome')} />
        case 'welcome':
            return (
                <AuthScreen>
                    <div style={{ flex: 1 }} />
                    <AuthBrand />
                    <div style={{ flex: 1 }} />
                    <AuthActions fixedBottom>
                        <AuthButton onClick={() => setState('signup')}>はじめる</AuthButton>
                        <AuthTextButton onClick={() => setState('signin')}>ログイン</AuthTextButton>
                    </AuthActions>
                </AuthScreen>
            )
        case 'missing':
            return (
                <RecoveryView
                    ccid={existingCCID!}
                    reload={reload}
                    giveup={() => setState('signup')}
                    setDomain={(domain) => {
                        setResolver(domain)
                    }}
                />
            )
        case 'ready':
            return (
                <AuthScreen>
                    <AuthHeader
                        title="おかえりなさい"
                        description="この端末に保存されているアカウントを確認しました。"
                    />
                    <div style={authStyles.passportWrap}>
                        <Tilt glareEnable={true} glareBorderRadius="5%">
                            <Passport
                                ccid={user!.ccid}
                                name={user!.profile?.value.username ?? 'No Name'}
                                avatar={user!.profile?.value.avatar ?? ''}
                                host={user!.entity?.value.domain ?? 'Unknown'}
                                cdate=""
                            />
                        </Tilt>
                    </div>
                    <AuthActions fixedBottom>
                        <AuthButton
                            onClick={async () => {
                                if (!user || !user.entity) return
                                const ckid: string = await invoke('create_subkey')

                                const subkeyDoc: Document<any> = {
                                    key: semantics.subkey(user.ccid, ckid),
                                    author: user.ccid,
                                    schema: 'https://schema.concrnt.net/subkey.json',
                                    value: {
                                        ckid
                                    },
                                    createdAt: new Date()
                                }

                                const authProvider = new TauriAuthProvider(user.ccid)
                                const kvs = new InMemoryKVS()

                                const api = new Api(user.entity.value.domain, authProvider, kvs)

                                await api.commit(subkeyDoc, user.entity.value.domain, { useMasterkey: true })
                                console.log('Subkey Registered')

                                await invoke('set_domain', { domain: user.entity.value.domain })

                                reset()
                                window.location.reload()
                            }}
                        >
                            このアカウントで続行
                        </AuthButton>
                        <AuthTextButton
                            danger
                            onClick={async () => {
                                await invoke('clear_all')
                                reload()
                            }}
                        >
                            端末のアカウント情報をリセットする
                        </AuthTextButton>
                    </AuthActions>
                </AuthScreen>
            )
    }
}

const RecoveryView = (props: {
    reload: () => void
    giveup: () => void
    setDomain?: (domain: string) => void
    ccid: string
}) => {
    const [found, setFound] = useState<boolean>(false)
    const [domain, setDomain] = useState<string>()

    useEffect(() => {
        if (!domain) return

        const auth = new InMemoryAuthProvider()
        const kvs = new InMemoryKVS()
        const api = new Api(domain, auth, kvs)

        api.getEntity(props.ccid)
            .then((entity) => {
                if (entity) {
                    setFound(true)
                    props.setDomain?.(entity.value.domain)
                } else {
                    setFound(false)
                }
            })
            .catch(() => {
                setFound(false)
            })
    }, [domain])

    return (
        <AuthScreen align="top">
            <AuthHeader
                title="登録サーバーを確認してください"
                description="端末にはアカウント情報がありますが、現在のサーバーでは登録情報が見つかりませんでした。"
            />
            <div style={authStyles.section}>
                <div style={authStyles.inputGroup}>
                    <Text style={{ color: CssVar.uiText }}>サーバーアドレス</Text>
                    <TextField
                        value={domain}
                        onChange={(e) => setDomain(e.target.value)}
                        placeholder="サーバーアドレスを入力"
                    />
                </div>
                <Text style={authStyles.status}>
                    {found ? '登録情報が見つかりました。' : '登録情報が見つかりませんでした。'}
                </Text>
            </div>
            {found ? (
                <AuthActions fixedBottom>
                    <AuthButton onClick={props.reload}>続行</AuthButton>
                </AuthActions>
            ) : (
                <AuthActions fixedBottom>
                    <AuthButton
                        onClick={() => {
                            props.giveup()
                        }}
                    >
                        新規登録する
                    </AuthButton>
                    <AuthTextButton
                        danger
                        onClick={async () => {
                            await invoke('clear_all')
                            props.reload()
                        }}
                    >
                        端末のアカウント情報を削除
                    </AuthTextButton>
                </AuthActions>
            )}
        </AuthScreen>
    )
}
