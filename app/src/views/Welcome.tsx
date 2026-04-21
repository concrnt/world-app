import { invoke } from '@tauri-apps/api/core'
import { Button, ConcrntLogo, CssVar, Text, TextField, View } from '@concrnt/ui'
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
                const profile = await api.getDocument<ProfileSchema>(semantics.profile(ccid)).catch(() => undefined)

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
                <div
                    style={{
                        height: '100dvh',
                        width: '100dvw',
                        backgroundColor: CssVar.uiBackground,
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        paddingTop: 'env(safe-area-inset-top)',
                        paddingBottom: 'env(safe-area-inset-bottom)'
                    }}
                >
                    <div
                        style={{
                            display: 'flex',
                            flexDirection: 'row',
                            alignItems: 'center'
                        }}
                    >
                        <ConcrntLogo
                            size="100px"
                            upperColor={CssVar.uiText}
                            lowerColor={CssVar.uiText}
                            frameColor={CssVar.uiText}
                        />
                        <Text
                            style={{
                                fontSize: '50px',
                                color: CssVar.uiText
                            }}
                        >
                            Concrnt
                        </Text>
                    </div>

                    <div
                        style={{
                            position: 'absolute',
                            bottom: 'calc(env(safe-area-inset-bottom) + 20px)',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            gap: CssVar.space(4)
                        }}
                    >
                        <Button
                            variant="contained"
                            onClick={() => setState('signup')}
                            style={{
                                color: CssVar.uiBackground,
                                backgroundColor: CssVar.uiText,
                                width: '80vw'
                            }}
                        >
                            はじめる
                        </Button>
                        <Button
                            variant="text"
                            onClick={() => setState('signin')}
                            style={{
                                color: CssVar.uiText
                            }}
                        >
                            ログイン
                        </Button>
                    </div>
                </div>
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
                <View
                    style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center'
                    }}
                >
                    <Text variant="h1">おかえりなさい！</Text>
                    <div
                        style={{
                            width: '90vw',
                            margin: '20px 0'
                        }}
                    >
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
                    <div style={{ flex: 1 }} />
                    <div
                        style={{
                            position: 'absolute',
                            bottom: 'calc(env(safe-area-inset-bottom) + 20px)',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            gap: CssVar.space(4)
                        }}
                    >
                        <Button
                            style={{
                                width: '80vw'
                            }}
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
                        </Button>
                        <Button
                            variant="text"
                            style={{
                                width: '80vw'
                            }}
                            onClick={async () => {
                                await invoke('clear_all')
                                reload()
                            }}
                        >
                            端末のアカウント情報をリセットする
                        </Button>
                    </div>
                </View>
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
        <View
            style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                padding: 20,
                gap: 20
            }}
        >
            <Text variant="h1">おかえりなさい！</Text>
            <Text>端末にはアカウント情報が保存されていますが、サーバーに登録情報が見つかりませんでした...。</Text>
            <Text>手動でサーバーアドレスを入力して検索するか、所望のサーバーに新規登録することができます。</Text>

            <TextField
                value={domain}
                onChange={(e) => setDomain(e.target.value)}
                placeholder="サーバーアドレスを入力"
            />
            <Text>{found ? '登録情報が見つかりました！' : '登録情報が見つかりませんでした...'}</Text>
            {found ? (
                <Button>続行</Button>
            ) : (
                <div style={{}}>
                    <Button
                        variant="text"
                        style={{
                            width: '80vw'
                        }}
                        onClick={() => {
                            props.giveup()
                        }}
                    >
                        新規登録する
                    </Button>

                    <Button
                        variant="text"
                        style={{
                            width: '80vw'
                        }}
                        onClick={async () => {
                            await invoke('clear_all')
                            props.reload()
                        }}
                    >
                        端末のアカウント情報を削除
                    </Button>
                </div>
            )}
        </View>
    )
}
